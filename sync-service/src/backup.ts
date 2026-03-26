/**
 * MongoDB Backup Service
 * 
 * Runs mongodump at 2:30 AM IST daily and saves backups to /backup directory.
 * Retains only the last 3 days of backups, deleting older ones automatically.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { logger } from './logger';
import { SyncConfig } from './config';

const execAsync = promisify(exec);

const BACKUP_DIR = '/backup';
const MAX_BACKUP_DAYS = 3;

/**
 * Get formatted date string for backup folder name
 */
function getBackupFolderName(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `backup_${year}-${month}-${day}_${hours}-${minutes}`;
}

/**
 * Delete backups older than MAX_BACKUP_DAYS
 */
async function cleanOldBackups(): Promise<void> {
    try {
        if (!fs.existsSync(BACKUP_DIR)) return;

        const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true });
        const backupDirs = entries
            .filter(e => e.isDirectory() && e.name.startsWith('backup_'))
            .map(e => ({
                name: e.name,
                path: path.join(BACKUP_DIR, e.name),
                // Parse date from folder name: backup_YYYY-MM-DD_HH-MM
                date: (() => {
                    const match = e.name.match(/backup_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})/);
                    if (match) {
                        return new Date(
                            parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]),
                            parseInt(match[4]), parseInt(match[5])
                        );
                    }
                    // Fallback: use folder mtime
                    return fs.statSync(path.join(BACKUP_DIR, e.name)).mtime;
                })(),
            }))
            .sort((a, b) => b.date.getTime() - a.date.getTime()); // newest first

        // Keep only the last MAX_BACKUP_DAYS days of backups
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - MAX_BACKUP_DAYS);

        for (const backup of backupDirs) {
            if (backup.date < cutoffDate) {
                logger.info(`Deleting old backup: ${backup.name}`);
                fs.rmSync(backup.path, { recursive: true, force: true });
            }
        }
    } catch (error) {
        logger.error('Error cleaning old backups:', error);
    }
}

/**
 * Perform a mongodump backup of the local MongoDB
 */
export async function performBackup(config: SyncConfig): Promise<void> {
    const folderName = getBackupFolderName();
    const backupPath = path.join(BACKUP_DIR, folderName);

    logger.info(`=== Starting MongoDB Backup ===`);
    logger.info(`Backup destination: ${backupPath}`);

    try {
        // Ensure backup directory exists
        fs.mkdirSync(backupPath, { recursive: true });

        // Parse the local MongoDB URL to extract host/port
        // DB_URL format: mongodb://mongodb:27017/gameserver?replicaSet=rs0
        const url = new URL(config.localDbUrl);
        const host = url.hostname || 'mongodb';
        const port = url.port || '27017';

        // Run mongodump
        const cmd = `mongodump --host=${host} --port=${port} --db=${config.dbName} --out=${backupPath} --gzip`;
        logger.info(`Running: ${cmd}`);

        const { stdout, stderr } = await execAsync(cmd, { timeout: 300000 }); // 5 min timeout

        if (stdout) logger.info(`mongodump stdout: ${stdout}`);
        if (stderr) logger.info(`mongodump stderr: ${stderr}`);

        // Verify backup was created
        const dbBackupPath = path.join(backupPath, config.dbName);
        if (fs.existsSync(dbBackupPath)) {
            const files = fs.readdirSync(dbBackupPath);
            logger.info(`Backup completed: ${files.length} files in ${dbBackupPath}`);
        } else {
            logger.warn('Backup directory exists but database subfolder not found');
        }

        // Clean old backups
        await cleanOldBackups();

        logger.info(`=== MongoDB Backup Complete ===`);
    } catch (error: any) {
        logger.error('MongoDB backup failed:', error.message);

        // Clean up failed backup folder
        try {
            if (fs.existsSync(backupPath)) {
                fs.rmSync(backupPath, { recursive: true, force: true });
            }
        } catch {
            // ignore cleanup errors
        }
    }
}

/**
 * Schedule daily backup at 2:30 AM IST using node-cron.
 */
export function scheduleBackup(config: SyncConfig): void {
    logger.info('Scheduling daily MongoDB backup at 2:30 AM IST via node-cron');

    // Cron expression: minute hour day month weekday
    // "30 2 * * *" = every day at 2:30 AM
    cron.schedule('30 2 * * *', async () => {
        logger.info('Cron triggered: Starting daily MongoDB backup...');
        await performBackup(config);
    }, {
        timezone: 'Asia/Kolkata',
    });

    logger.info('Backup cron job registered: 30 2 * * * (Asia/Kolkata)');
}
