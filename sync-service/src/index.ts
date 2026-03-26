/**
 * Cricket Sync Service
 * 
 * Standalone service that keeps local MongoDB in sync with MongoDB Atlas.
 * 
 * Flow:
 * 1. On startup, performs initial sync (Atlas → Local) if not done already
 * 2. Then starts Change Stream watcher (Local → Atlas) for real-time sync
 * 3. Exposes a health check endpoint on port 3099
 * 4. Schedules daily MongoDB backup at 2:30 AM IST (keeps last 3 days)
 */

import http from 'http';
import { loadConfig } from './config';
import { logger } from './logger';
import { performInitialSync, isInitialSyncDone } from './initialSync';
import { startChangeStreamSync } from './changeStreamSync';
import { scheduleBackup } from './backup';
import { MongoClient } from 'mongodb';

let syncHandle: { stop: () => Promise<void> } | null = null;
let isHealthy = false;

async function main(): Promise<void> {
    logger.info('========================================');
    logger.info('  Cricket Sync Service Starting');
    logger.info('========================================');

    const config = loadConfig();

    logger.info(`Local DB URL: ${config.localDbUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    logger.info(`Atlas DB URL: ${config.atlasDbUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    logger.info(`Database: ${config.dbName}`);

    // Wait for local MongoDB to be ready
    await waitForMongoDB(config.localDbUrl, 'Local MongoDB');

    // Step 1: Check if initial sync is needed
    const localClient = new MongoClient(config.localDbUrl);
    await localClient.connect();
    const localDb = localClient.db(config.dbName);
    const syncDone = await isInitialSyncDone(localDb);
    await localClient.close();

    if (!syncDone) {
        logger.info('Initial sync not completed. Starting full sync from Atlas...');
        await performInitialSync(config);
    } else {
        logger.info('Initial sync already completed. Skipping to change stream.');
    }

    // Step 2: Start change stream sync (Local → Atlas)
    syncHandle = await startChangeStreamSync(config);
    isHealthy = true;

    // Step 3: Start health check server
    startHealthCheck(config.healthCheckPort);

    // Step 4: Schedule daily backup at 2:30 AM IST
    scheduleBackup(config);

    logger.info('========================================');
    logger.info('  Sync Service Running');
    logger.info('  Backup scheduled: 2:30 AM IST daily');
    logger.info('========================================');
}

/**
 * Wait for MongoDB to become available
 */
async function waitForMongoDB(url: string, name: string): Promise<void> {
    const maxRetries = 30;
    const retryDelay = 2000;

    for (let i = 1; i <= maxRetries; i++) {
        try {
            const client = new MongoClient(url, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000,
            });
            await client.connect();
            await client.db('admin').command({ ping: 1 });
            await client.close();
            logger.info(`${name} is ready`);
            return;
        } catch (err) {
            logger.warn(`Waiting for ${name} (attempt ${i}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    throw new Error(`${name} did not become available after ${maxRetries} attempts`);
}

/**
 * Simple HTTP health check endpoint
 */
function startHealthCheck(port: number): void {
    const server = http.createServer((req, res) => {
        if (req.url === '/health') {
            if (isHealthy) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'healthy', service: 'cricket-sync-service', timestamp: new Date().toISOString() }));
            } else {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'unhealthy', service: 'cricket-sync-service', timestamp: new Date().toISOString() }));
            }
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    });

    server.listen(port, () => {
        logger.info(`Health check endpoint running on port ${port}`);
    });
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string): Promise<void> {
    logger.info(`${signal} received. Shutting down sync service...`);
    isHealthy = false;

    if (syncHandle) {
        await syncHandle.stop();
    }

    logger.info('Sync service shutdown complete');
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Start the service
main().catch((error) => {
    logger.error('Fatal error starting sync service:', error);
    process.exit(1);
});
