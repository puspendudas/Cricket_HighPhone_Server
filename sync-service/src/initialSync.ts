/**
 * Initial Sync: Copies all data from Atlas → Local MongoDB on first boot.
 * This ensures the local database has all existing data before change streams start.
 */

import { MongoClient, Db } from 'mongodb';
import { SyncConfig } from './config';
import { logger } from './logger';

const SYNC_META_COLLECTION = '_sync_meta';

interface SyncMetaDoc {
    _id: string;
    initialSyncComplete: boolean;
    completedAt: Date;
    collectionsCount: number;
    totalDocuments: number;
}

/**
 * Check if initial sync has already been completed
 */
export async function isInitialSyncDone(localDb: Db): Promise<boolean> {
    try {
        const meta = await localDb.collection<SyncMetaDoc>(SYNC_META_COLLECTION).findOne({ _id: 'initial_sync' });
        return meta?.initialSyncComplete === true;
    } catch {
        return false;
    }
}

/**
 * Perform full initial sync from Atlas to Local MongoDB
 */
export async function performInitialSync(config: SyncConfig): Promise<void> {
    logger.info('=== Starting Initial Sync: Atlas → Local MongoDB ===');

    let atlasClient: MongoClient | null = null;
    let localClient: MongoClient | null = null;

    try {
        // Connect to both databases
        logger.info('Connecting to Atlas...');
        atlasClient = new MongoClient(config.atlasDbUrl);
        await atlasClient.connect();
        const atlasDb = atlasClient.db(config.dbName);

        logger.info('Connecting to Local MongoDB...');
        localClient = new MongoClient(config.localDbUrl);
        await localClient.connect();
        const localDb = localClient.db(config.dbName);

        // Check if already synced
        if (await isInitialSyncDone(localDb)) {
            logger.info('Initial sync already completed. Skipping.');
            return;
        }

        // Get all collections from Atlas (exclude system collections)
        const collections = await atlasDb.listCollections().toArray();
        const userCollections = collections.filter(
            c => !c.name.startsWith('system.') && c.name !== SYNC_META_COLLECTION
        );

        logger.info(`Found ${userCollections.length} collections to sync`);

        let totalDocuments = 0;

        for (const collInfo of userCollections) {
            const collName = collInfo.name;
            logger.info(`Syncing collection: ${collName}...`);

            const atlasCollection = atlasDb.collection(collName);
            const localCollection = localDb.collection(collName);

            // Get count for progress tracking
            const docCount = await atlasCollection.countDocuments();
            logger.info(`  Collection "${collName}": ${docCount} documents`);

            if (docCount === 0) {
                // Ensure collection exists even if empty
                await localDb.createCollection(collName).catch(() => { });
                logger.info(`  Collection "${collName}": created (empty)`);
                continue;
            }

            // Batch copy documents
            let copied = 0;
            const cursor = atlasCollection.find({});
            let batch: any[] = [];

            while (await cursor.hasNext()) {
                const doc = await cursor.next();
                if (doc) {
                    batch.push(doc);
                }

                if (batch.length >= config.batchSize) {
                    await localCollection.insertMany(batch, { ordered: false }).catch(err => {
                        // Ignore duplicate key errors (E11000) — documents already exist
                        if (err.code !== 11000 && !err.message?.includes('E11000')) {
                            throw err;
                        }
                    });
                    copied += batch.length;
                    logger.info(`  Collection "${collName}": ${copied}/${docCount} documents copied`);
                    batch = [];
                }
            }

            // Insert remaining batch
            if (batch.length > 0) {
                await localCollection.insertMany(batch, { ordered: false }).catch(err => {
                    if (err.code !== 11000 && !err.message?.includes('E11000')) {
                        throw err;
                    }
                });
                copied += batch.length;
            }

            totalDocuments += copied;
            logger.info(`  Collection "${collName}": completed (${copied} documents)`);

            // Copy indexes
            try {
                const indexes = await atlasCollection.indexes();
                for (const index of indexes) {
                    if (index.name === '_id_') continue; // Skip default _id index

                    const key = index.key;
                    const options: any = {};

                    if (index.unique) options.unique = index.unique;
                    if (index.sparse) options.sparse = index.sparse;
                    if (index.expireAfterSeconds !== undefined) options.expireAfterSeconds = index.expireAfterSeconds;
                    if (index.name) options.name = index.name;

                    try {
                        await localCollection.createIndex(key, options);
                    } catch (indexErr: any) {
                        // Index might already exist
                        if (!indexErr.message?.includes('already exists')) {
                            logger.warn(`  Failed to create index ${index.name} on ${collName}:`, indexErr.message);
                        }
                    }
                }
                logger.info(`  Collection "${collName}": indexes synced`);
            } catch (indexErr) {
                logger.warn(`  Failed to sync indexes for ${collName}:`, indexErr);
            }
        }

        // Mark initial sync as complete
        await localDb.collection(SYNC_META_COLLECTION).updateOne(
            { _id: 'initial_sync' as any },
            {
                $set: {
                    initialSyncComplete: true,
                    completedAt: new Date(),
                    collectionsCount: userCollections.length,
                    totalDocuments,
                },
            },
            { upsert: true }
        );

        logger.info(`=== Initial Sync Complete ===`);
        logger.info(`  Collections: ${userCollections.length}`);
        logger.info(`  Total documents: ${totalDocuments}`);

    } catch (error) {
        logger.error('Initial sync failed:', error);
        throw error;
    } finally {
        if (atlasClient) await atlasClient.close();
        if (localClient) await localClient.close();
    }
}
