// cronWorkerManager.ts

import { Worker } from 'worker_threads';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '@utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * CronWorkerManager handles communication with the cron worker thread
 * Provides a clean interface for the main application to manage cron jobs
 */
class CronWorkerManager {
  private worker: Worker | null = null;
  private pendingMessages: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout; type: string }> = new Map();

  private isInitialized = false;
  private readonly workerPath: string;
  private fallbackMode = false;

  constructor() {
    this.workerPath = path.join(__dirname, '../workers/cronWorker.ts');
  }

  /**
   * Initialize the worker thread
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('CronWorkerManager: Already initialized');
      return;
    }

    try {
      // Create worker thread with better error handling

      // Try both .ts and .js files
      let workerPath = path.join(__dirname, '../workers/cronWorker.ts');
      if (!fs.existsSync(workerPath)) {
        workerPath = path.join(__dirname, '../workers/cronWorker.js');
        logger.info(`CronWorkerManager: .ts file not found, trying .js file`);
      }

      logger.info(`CronWorkerManager: Starting worker at path: ${workerPath}`);
      logger.info(`CronWorkerManager: Current directory: ${__dirname}`);
      logger.info(`CronWorkerManager: Node version: ${process.version}`);
      logger.info(`CronWorkerManager: Worker file exists: ${fs.existsSync(workerPath)}`);

      this.worker = new Worker(workerPath, {
        execArgv: [
          '--require', 'ts-node/register',
          '--require', 'tsconfig-paths/register',
          '--require', 'reflect-metadata'
        ]
      });

      // Setup message handler
      this.worker.on('message', (message) => {
        this.handleWorkerMessage(message);
      });

      // Setup error handler
      this.worker.on('error', (error) => {
        logger.error('CronWorkerManager: Worker error:', error);
        logger.error('CronWorkerManager: Worker error stack:', error.stack);
        logger.error('CronWorkerManager: Worker error message:', error.message);
        this.handleWorkerError(error);
      });

      // Setup exit handler
      this.worker.on('exit', (code) => {
        if (code !== 0) {
          logger.error(`CronWorkerManager: Worker stopped with exit code ${code}`);
        } else {
          logger.info('CronWorkerManager: Worker exited gracefully');
        }
        this.cleanup();
      });

      // Add online event handler
      this.worker.on('online', () => {
        logger.info('CronWorkerManager: Worker thread is online');
      });

      // Wait for worker to be ready with a proper timeout
      await this.waitForWorkerReady();

      this.isInitialized = true;
      logger.info('CronWorkerManager: Worker thread initialized successfully');
    } catch (error) {
      logger.error('CronWorkerManager: Failed to initialize worker:', error);
      logger.warn('CronWorkerManager: Falling back to non-worker mode');
      this.fallbackMode = true;
      this.isInitialized = true;
      logger.info('CronWorkerManager: Initialized in fallback mode (no worker thread)');
    }
  }

  /**
   * Wait for worker to be ready by sending a ping message
   */
  private async waitForWorkerReady(): Promise<void> {
    try {
      // Wait for the worker to come online first
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker failed to come online within 15 seconds'));
        }, 15000);

        if (this.worker) {
          this.worker.once('online', () => {
            clearTimeout(timeout);
            logger.info('CronWorkerManager: Worker is online, attempting ping...');
            resolve();
          });

          this.worker.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        } else {
          clearTimeout(timeout);
          reject(new Error('Worker is null'));
        }
      });

      // Give the worker more time to set up message handlers and initialize
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Now try to ping the worker to ensure it's ready (increased timeout for database connection)
      await this.sendMessage('PING', null, 30000);
      logger.info('CronWorkerManager: Worker is ready and responding');
    } catch (error) {
      logger.error('CronWorkerManager: Worker initialization failed:', error);
      throw new Error('Worker failed to initialize properly');
    }
  }

  /**
   * Handle messages from worker thread
   */
  private handleWorkerMessage(message: any): void {
    const { id, success, data, error, critical, type } = message;

    // Handle WORKER_READY signal
    if (type === 'WORKER_READY') {
      logger.info('CronWorkerManager: Received WORKER_READY signal from worker');
      // Find any pending PING message and resolve it
      for (const [messageId, pendingMessage] of this.pendingMessages) {
        if (pendingMessage.type === 'PING') {
          clearTimeout(pendingMessage.timeout);
          this.pendingMessages.delete(messageId);
          pendingMessage.resolve({ success: true, message: 'Worker is ready' });
          logger.info('CronWorkerManager: Resolved pending PING with WORKER_READY');
          break;
        }
      }
      return;
    }

    // Handle critical errors that require main thread attention
    if (critical) {
      logger.error('CronWorkerManager: Critical error from worker:', error);
      if (error === 'API access forbidden') {
        // Handle API access forbidden error
        process.exit(1);
      }
      return;
    }

    // Handle response to pending message
    const pendingMessage = this.pendingMessages.get(id);
    if (pendingMessage) {
      clearTimeout(pendingMessage.timeout);
      this.pendingMessages.delete(id);

      if (success) {
        pendingMessage.resolve({ success, data, message: message.message });
      } else {
        pendingMessage.reject(new Error(error || 'Unknown worker error'));
      }
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: Error): void {
    // Reject all pending messages
    for (const [, pendingMessage] of this.pendingMessages) {
      clearTimeout(pendingMessage.timeout);
      pendingMessage.reject(error);
    }
    this.pendingMessages.clear();

    this.cleanup();
  }

  /**
   * Send message to worker thread
   */
  private async sendMessage(type: string, data?: any, timeoutMs = 45000): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker not available');
    }

    // Allow PING messages during initialization
    if (!this.isInitialized && type !== 'PING') {
      throw new Error('Worker not initialized');
    }

    const messageId = uuidv4();
    const message = { id: messageId, type, data };

    return new Promise((resolve, reject) => {
      // Set timeout for message response
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error(`Worker message timeout for type: ${type}`));
      }, timeoutMs);

      // Store pending message with type for identification
      this.pendingMessages.set(messageId, { resolve, reject, timeout, type });

      // Send message to worker
      if (!this.worker) {
        throw new Error('Worker not available');
      }
      this.worker.postMessage(message);
    });
  }

  /**
   * Start match cron job in worker thread
   */
  public async startMatchCronJob(): Promise<void> {
    if (this.fallbackMode) {
      logger.warn('CronWorkerManager: Running in fallback mode - match cron job disabled');
      return;
    }

    try {
      const result = await this.sendMessage('START_MATCH_CRON');
      logger.info('CronWorkerManager: Match cron job started successfully');
      return result;
    } catch (error) {
      logger.error('CronWorkerManager: Failed to start match cron job:', error);
      throw error;
    }
  }

  /**
   * Stop match cron job in worker thread
   */
  public async stopMatchCronJob(): Promise<void> {
    if (this.fallbackMode) {
      logger.warn('CronWorkerManager: Running in fallback mode - match cron job already disabled');
      return;
    }

    try {
      const result = await this.sendMessage('STOP_MATCH_CRON');
      logger.info('CronWorkerManager: Match cron job stopped successfully');
      return result;
    } catch (error) {
      logger.error('CronWorkerManager: Failed to stop match cron job:', error);
      throw error;
    }
  }



  /**
   * Get status of match cron job from worker thread
   */
  public async getCronJobsStatus(): Promise<any> {
    if (this.fallbackMode) {
      logger.warn('CronWorkerManager: Running in fallback mode - returning disabled status');
      return {
        match: { isRunning: false, schedule: 'Disabled - fallback mode' },
        timestamp: new Date().toISOString(),
        fallbackMode: true
      };
    }

    try {
      const result = await this.sendMessage('GET_CRON_STATUS');
      return result.data;
    } catch (error) {
      logger.error('CronWorkerManager: Failed to get cron jobs status:', error);
      throw error;
    }
  }



  /**
   * Check if match cron job is running
   */
  public async isMatchCronRunning(): Promise<boolean> {
    if (this.fallbackMode) {
      return false;
    }

    try {
      const status = await this.getCronJobsStatus();
      return status.match === 'running';
    } catch (error) {
      logger.error('CronWorkerManager: Failed to check match cron status:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.isInitialized = false;

    // Clear all pending messages
    for (const [, pendingMessage] of this.pendingMessages) {
      clearTimeout(pendingMessage.timeout);
      pendingMessage.reject(new Error('Worker terminated'));
    }
    this.pendingMessages.clear();
  }

  /**
   * Shutdown worker thread
   */
  public async shutdown(): Promise<void> {
    if (this.fallbackMode || !this.worker || !this.isInitialized) {
      logger.warn('CronWorkerManager: Worker not initialized or in fallback mode, nothing to shutdown');
      return;
    }

    try {
      // Send shutdown message to worker
      await this.sendMessage('SHUTDOWN', null, 10000);

      // Terminate worker
      await this.worker.terminate();

      logger.info('CronWorkerManager: Worker shutdown completed');
    } catch (error) {
      logger.error('CronWorkerManager: Error during shutdown:', error);

      // Force terminate if graceful shutdown fails
      if (this.worker) {
        await this.worker.terminate();
      }
    } finally {
      this.worker = null;
      this.cleanup();
    }
  }
}

export default CronWorkerManager;