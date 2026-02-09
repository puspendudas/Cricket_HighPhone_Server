import { Worker } from 'worker_threads';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '@utils/logger';
import { v4 as uuidv4 } from 'uuid';

class AutoDeclareWorkerManager {
  private worker: Worker | null = null;
  private pendingMessages: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout; type: string }> = new Map();
  private isInitialized = false;
  private readonly workerPath: string;
  private fallbackMode = false;

  constructor() {
    this.workerPath = path.join(__dirname, '../workers/autoDeclareWorker.ts');
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('AutoDeclareWorkerManager: Already initialized');
      return;
    }

    try {
      let workerPath = this.workerPath;
      if (!fs.existsSync(workerPath)) {
        workerPath = path.join(__dirname, '../workers/autoDeclareWorker.js');
        logger.info('AutoDeclareWorkerManager: .ts file not found, trying .js file');
      }

      logger.info(`AutoDeclareWorkerManager: Starting worker at path: ${workerPath}`);

      this.worker = new Worker(workerPath, {
        execArgv: [
          '--require', 'ts-node/register',
          '--require', 'tsconfig-paths/register',
          '--require', 'reflect-metadata'
        ]
      });

      this.worker.on('message', (message) => {
        this.handleWorkerMessage(message);
      });

      this.worker.on('error', (error) => {
        logger.error('AutoDeclareWorkerManager: Worker error:', error);
        this.handleWorkerError(error);
      });

      this.worker.on('exit', (code) => {
        if (code !== 0) {
          logger.error(`AutoDeclareWorkerManager: Worker stopped with exit code ${code}`);
        }
        this.cleanup();
      });

      await this.waitForWorkerReady();
      this.isInitialized = true;
      logger.info('AutoDeclareWorkerManager: Worker initialized successfully');
    } catch (error) {
      logger.error('AutoDeclareWorkerManager: Failed to initialize worker:', error);
      this.fallbackMode = true;
      this.isInitialized = true;
    }
  }

  private async waitForWorkerReady(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker failed to come online within 15 seconds'));
      }, 15000);

      if (this.worker) {
        this.worker.once('online', () => {
          clearTimeout(timeout);
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

    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.sendMessage('PING', null, 30000);
  }

  private handleWorkerMessage(message: any): void {
    const { id, success, data, error, type } = message;

    if (type === 'WORKER_READY') {
      for (const [messageId, pendingMessage] of this.pendingMessages) {
        if (pendingMessage.type === 'PING') {
          clearTimeout(pendingMessage.timeout);
          this.pendingMessages.delete(messageId);
          pendingMessage.resolve({ success: true, message: 'Worker is ready' });
          break;
        }
      }
      return;
    }

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

  private handleWorkerError(error: Error): void {
    for (const [, pendingMessage] of this.pendingMessages) {
      clearTimeout(pendingMessage.timeout);
      pendingMessage.reject(error);
    }
    this.pendingMessages.clear();
    this.cleanup();
  }

  private async sendMessage(type: string, data?: any, timeoutMs = 45000): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker not available');
    }

    if (!this.isInitialized && type !== 'PING') {
      throw new Error('Worker not initialized');
    }

    const messageId = uuidv4();
    const message = { id: messageId, type, data };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error(`Worker message timeout for type: ${type}`));
      }, timeoutMs);

      this.pendingMessages.set(messageId, { resolve, reject, timeout, type });
      this.worker?.postMessage(message);
    });
  }

  public async startAutoDeclareCronJob(): Promise<void> {
    if (this.fallbackMode) {
      logger.warn('AutoDeclareWorkerManager: Running in fallback mode - auto declare cron disabled');
      return;
    }

    await this.sendMessage('START_AUTO_DECLARE_CRON');
  }

  public async stopAutoDeclareCronJob(): Promise<void> {
    if (this.fallbackMode) {
      logger.warn('AutoDeclareWorkerManager: Running in fallback mode - auto declare cron disabled');
      return;
    }

    await this.sendMessage('STOP_AUTO_DECLARE_CRON');
  }

  public async getCronJobsStatus(): Promise<any> {
    if (this.fallbackMode) {
      return {
        autoDeclare: { isRunning: false, schedule: 'Disabled - fallback mode' },
        timestamp: new Date().toISOString(),
        fallbackMode: true
      };
    }

    const result = await this.sendMessage('GET_CRON_STATUS');
    return result.data;
  }

  private cleanup(): void {
    this.isInitialized = false;
    for (const [, pendingMessage] of this.pendingMessages) {
      clearTimeout(pendingMessage.timeout);
      pendingMessage.reject(new Error('Worker terminated'));
    }
    this.pendingMessages.clear();
  }

  public async shutdown(): Promise<void> {
    if (this.fallbackMode || !this.worker || !this.isInitialized) {
      return;
    }

    try {
      await this.sendMessage('SHUTDOWN', null, 10000);
      await this.worker.terminate();
    } catch (error) {
      if (this.worker) {
        await this.worker.terminate();
      }
    } finally {
      this.worker = null;
      this.cleanup();
    }
  }
}

const autoDeclareWorkerManager = new AutoDeclareWorkerManager();

export { autoDeclareWorkerManager };
export default AutoDeclareWorkerManager;
