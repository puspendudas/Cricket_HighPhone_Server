/**
 * Change Stream Sync: Watches local MongoDB for changes and replicates them to Atlas in real-time.
 * Uses MongoDB Change Streams with resume tokens for reliable, resumable syncing.
 */

import { MongoClient, Db, ChangeStream, ChangeStreamDocument, ResumeToken } from 'mongodb';
import { SyncConfig } from './config';
import { logger } from './logger';

const SYNC_META_COLLECTION = '_sync_meta';
const RESUME_TOKEN_KEY = 'resume_token';

// Collections to skip syncing (internal sync metadata)
const SKIP_COLLECTIONS = new Set([SYNC_META_COLLECTION]);

interface ResumeTokenDoc {
    _id: string;
    token: ResumeToken;
    updatedAt: Date;
}

/**
 * Save resume token so we can continue from where we left off after restart
 */
async function saveResumeToken(localDb: Db, token: ResumeToken): Promise<void> {
    await localDb.collection(SYNC_META_COLLECTION).updateOne(
        { _id: RESUME_TOKEN_KEY as any },
        {
            $set: {
                token,
                updatedAt: new Date(),
            },
        },
        { upsert: true }
    );
}

/**
 * Load saved resume token
 */
async function loadResumeToken(localDb: Db): Promise<ResumeToken | null> {
    const doc = await localDb.collection<ResumeTokenDoc>(SYNC_META_COLLECTION).findOne({
        _id: RESUME_TOKEN_KEY as any,
    });
    return doc?.token || null;
}

/**
 * Process a single change stream event and replicate to Atlas
 */
async function processChange(change: ChangeStreamDocument, atlasDb: Db, localDb: Db): Promise<void> {
    const ns = (change as any).ns;
    if (!ns || !ns.coll) {
        return;
    }

    const collectionName = ns.coll;

    // Skip internal sync collections
    if (SKIP_COLLECTIONS.has(collectionName)) {
        return;
    }

    const atlasCollection = atlasDb.collection(collectionName);

    try {
        switch (change.operationType) {
            case 'insert': {
                const doc = (change as any).fullDocument;
                if (doc) {
                    await atlasCollection.replaceOne(
                        { _id: doc._id },
                        doc,
                        { upsert: true }
                    );
                    logger.debug(`INSERT → Atlas: ${collectionName}/${doc._id}`);
                }
                break;
            }

            case 'update': {
                const doc = (change as any).fullDocument;
                const docKey = (change as any).documentKey;
                const updateDesc = (change as any).updateDescription;

                if (doc && docKey) {
                    await atlasCollection.replaceOne(
                        { _id: docKey._id },
                        doc,
                        { upsert: true }
                    );
                    logger.debug(`UPDATE (replaced) → Atlas: ${collectionName}/${docKey._id}`);
                } else if (updateDesc && docKey) {
                    const updateOps: any = {};

                    if (updateDesc.updatedFields && Object.keys(updateDesc.updatedFields).length > 0) {
                        updateOps.$set = updateDesc.updatedFields;
                    }

                    if (updateDesc.removedFields && updateDesc.removedFields.length > 0) {
                        updateOps.$unset = {};
                        for (const field of updateDesc.removedFields) {
                            updateOps.$unset[field] = '';
                        }
                    }

                    if (Object.keys(updateOps).length > 0) {
                        await atlasCollection.updateOne(
                            { _id: docKey._id },
                            updateOps,
                            { upsert: true }
                        );
                    }
                    logger.debug(`UPDATE (partial) → Atlas: ${collectionName}/${docKey._id}`);
                }
                break;
            }

            case 'replace': {
                const doc = (change as any).fullDocument;
                const docKey = (change as any).documentKey;
                if (doc && docKey) {
                    await atlasCollection.replaceOne(
                        { _id: docKey._id },
                        doc,
                        { upsert: true }
                    );
                    logger.debug(`REPLACE → Atlas: ${collectionName}/${docKey._id}`);
                }
                break;
            }

            case 'delete': {
                const docKey = (change as any).documentKey;
                if (docKey) {
                    await atlasCollection.deleteOne({ _id: docKey._id });
                    logger.debug(`DELETE → Atlas: ${collectionName}/${docKey._id}`);
                }
                break;
            }

            case 'drop': {
                logger.warn(`Collection dropped: ${collectionName}. Dropping from Atlas too.`);
                await atlasCollection.drop().catch(() => { });
                break;
            }

            case 'rename': {
                const toNs = (change as any).to;
                if (toNs) {
                    logger.warn(`Collection renamed: ${collectionName} → ${toNs.coll}`);
                    await atlasDb.collection(collectionName).rename(toNs.coll).catch(() => { });
                }
                break;
            }

            case 'invalidate': {
                logger.warn('Change stream invalidated. Will restart.');
                break;
            }

            default:
                logger.info(`Unhandled change type: ${change.operationType} on ${collectionName}`);
        }
    } catch (error: any) {
        // Log error but don't crash — the change stream should continue
        logger.error(`Failed to sync change (${change.operationType}) on ${collectionName}:`, {
            error: error.message,
            stack: error.stack,
        });
    }
}

/**
 * Sync statistics tracker
 */
class SyncStats {
    private counts: Record<string, number> = {};
    private lastLogTime = Date.now();
    private logIntervalMs = 60000; // Log stats every 60 seconds

    increment(operationType: string): void {
        this.counts[operationType] = (this.counts[operationType] || 0) + 1;

        const now = Date.now();
        if (now - this.lastLogTime >= this.logIntervalMs) {
            this.logStats();
            this.lastLogTime = now;
        }
    }

    logStats(): void {
        const total = Object.values(this.counts).reduce((a, b) => a + b, 0);
        if (total > 0) {
            logger.info(`Sync stats (last period): ${JSON.stringify(this.counts)}, total: ${total}`);
            this.counts = {};
        }
    }
}

/**
 * Start the Change Stream watcher
 * Watches the entire local database and replicates all changes to Atlas
 */
export async function startChangeStreamSync(config: SyncConfig): Promise<{
    stop: () => Promise<void>;
}> {
    logger.info('=== Starting Change Stream Sync: Local → Atlas ===');

    const localClient = new MongoClient(config.localDbUrl);
    const atlasClient = new MongoClient(config.atlasDbUrl);

    await localClient.connect();
    await atlasClient.connect();

    const localDb = localClient.db(config.dbName);
    const atlasDb = atlasClient.db(config.dbName);

    const stats = new SyncStats();
    let changeStream: ChangeStream | null = null;
    let running = true;
    let tokenSaveCounter = 0;
    const TOKEN_SAVE_INTERVAL = 10; // Save resume token every N changes

    const startStream = async (): Promise<void> => {
        // Load saved resume token
        const resumeToken = await loadResumeToken(localDb);

        const streamOptions: any = {
            fullDocument: 'updateLookup',
        };

        if (resumeToken) {
            streamOptions.resumeAfter = resumeToken;
            logger.info('Resuming change stream from saved token');
        } else {
            logger.info('Starting fresh change stream (no resume token found)');
        }

        // Watch the entire database
        changeStream = localDb.watch([], streamOptions);

        logger.info('Change stream watching started on local database');

        changeStream.on('change', async (change: ChangeStreamDocument) => {
            try {
                await processChange(change, atlasDb, localDb);
                stats.increment(change.operationType);

                // Periodically save resume token
                tokenSaveCounter++;
                if (tokenSaveCounter >= TOKEN_SAVE_INTERVAL && change._id) {
                    await saveResumeToken(localDb, change._id);
                    tokenSaveCounter = 0;
                }
            } catch (error) {
                logger.error('Error processing change:', error);
            }
        });

        changeStream.on('error', async (error: any) => {
            logger.error('Change stream error:', error);

            // If the oplog has rotated past our resume token, discard it and do
            // a fresh initial sync so Atlas doesn't miss the changes we can no
            // longer replay from the oplog.
            const isHistoryLost =
                error?.code === 286 ||
                error?.codeName === 'ChangeStreamHistoryLost' ||
                (error?.errorResponse?.codeName === 'ChangeStreamHistoryLost');

            if (isHistoryLost) {
                logger.warn('Resume token is stale (oplog rolled over). Clearing token and restarting stream from now.');
                await localDb.collection(SYNC_META_COLLECTION).deleteOne({ _id: RESUME_TOKEN_KEY as any });
            }

            if (running) {
                logger.info('Attempting to restart change stream in 5 seconds...');
                await new Promise(resolve => setTimeout(resolve, 5000));

                if (running) {
                    try {
                        await startStream();
                    } catch (restartError) {
                        logger.error('Failed to restart change stream:', restartError);
                    }
                }
            }
        });

        changeStream.on('close', () => {
            logger.info('Change stream closed');
        });
    };

    await startStream();

    // Return stop function for graceful shutdown
    return {
        stop: async () => {
            running = false;
            stats.logStats();

            if (changeStream) {
                await changeStream.close();
            }

            await localClient.close();
            await atlasClient.close();

            logger.info('Change stream sync stopped gracefully');
        },
    };
}
