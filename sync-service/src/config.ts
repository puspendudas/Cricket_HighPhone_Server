import { config } from 'dotenv';
import path from 'path';

// Load env from parent directory's .env files
config({ path: path.resolve(__dirname, '../../.env.production') });
config({ path: path.resolve(__dirname, '../../.env') });

export interface SyncConfig {
    localDbUrl: string;
    atlasDbUrl: string;
    dbName: string;
    syncIntervalMs: number;
    healthCheckPort: number;
    batchSize: number;
}

export function loadConfig(): SyncConfig {
    const localDbUrl = process.env.DB_URL;
    const atlasDbUrl = process.env.ATLAS_DB_URL;
    const dbName = process.env.DB_DATABASE || 'gameserver';

    if (!localDbUrl) {
        throw new Error('DB_URL environment variable is required');
    }

    if (!atlasDbUrl) {
        throw new Error('ATLAS_DB_URL environment variable is required');
    }

    return {
        localDbUrl,
        atlasDbUrl,
        dbName,
        syncIntervalMs: parseInt(process.env.SYNC_INTERVAL_MS || '1000', 10),
        healthCheckPort: parseInt(process.env.SYNC_HEALTH_PORT || '3099', 10),
        batchSize: parseInt(process.env.SYNC_BATCH_SIZE || '100', 10),
    };
}
