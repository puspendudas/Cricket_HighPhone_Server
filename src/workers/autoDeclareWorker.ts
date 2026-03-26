import { isMainThread, parentPort } from 'worker_threads';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import DB from '../databases';

function log(message: string, ...args: any[]) {
  logger.info(`[AutoDeclareWorker] ${message}`, ...args);
}

class AutoDeclareWorker {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private isReady = false;
  private autoDeclareService!: import('../services/autoDeclare.service').default;
  private isJobRunning = false;

  constructor() {
    try {
      this.initializeWorker().catch(error => {
        log(`Initialization failed: ${error.message}`);
      });
    } catch (error) {
      log(`Constructor error: ${(error as Error).message}`);
    }
  }

  private async initializeWorker(): Promise<void> {
    try {
      this.setupMessageHandlers();
      await DB();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Dynamic import keeps worker thread startup light; heavy graph (MatchBetService, etc.) loads after DB is up.
      const { default: AutoDeclareService } = await import('../services/autoDeclare.service');
      this.autoDeclareService = new AutoDeclareService();
      this.isReady = true;

      if (parentPort) {
        parentPort.postMessage({ type: 'WORKER_READY' });
      }
    } catch (error) {
      log(`Failed to initialize: ${(error as Error).message}`);
      this.isReady = false;
      if (parentPort) {
        parentPort.postMessage({
          type: 'WORKER_INIT_FAILED',
          error: (error as Error).message,
        });
      }
    }
  }

  private setupMessageHandlers(): void {
    if (!isMainThread && parentPort) {
      parentPort.on('message', async (message) => {
        try {
          await this.handleMessage(message);
        } catch (error) {
          log(`Error handling message: ${(error as Error).message}`);
          this.sendResponse(message.id, { success: false, error: (error as Error).message });
        }
      });
    }
  }

  private async handleMessage(message: any): Promise<void> {
    const { type, id } = message;

    if (type === 'PING') {
      this.sendResponse(id, {
        success: this.isReady,
        message: this.isReady ? 'Worker is ready' : 'Worker still initializing',
        error: this.isReady ? undefined : 'not_ready',
      });
      return;
    }

    if (!this.isReady) {
      this.sendResponse(id, { success: false, error: 'Worker is still initializing. Please try again.' });
      return;
    }

    switch (type) {
      case 'START_AUTO_DECLARE_CRON':
        await this.startAutoDeclareCronJob();
        this.sendResponse(id, { success: true, message: 'Auto declare cron job started' });
        break;
      case 'STOP_AUTO_DECLARE_CRON':
        this.stopAutoDeclareCronJob();
        this.sendResponse(id, { success: true, message: 'Auto declare cron job stopped' });
        break;
      case 'GET_CRON_STATUS':
        this.sendResponse(id, { success: true, data: this.getCronJobsStatus() });
        break;
      case 'SHUTDOWN':
        await this.shutdown();
        this.sendResponse(id, { success: true, message: 'Worker shutdown complete' });
        break;
      default:
        this.sendResponse(id, { success: false, error: 'Unknown message type' });
    }
  }

  private sendResponse(messageId: string, response: any): void {
    if (!isMainThread && parentPort) {
      parentPort.postMessage({ id: messageId, ...response });
    }
  }

  private getCronJobsStatus(): any {
    return {
      autoDeclare: {
        isRunning: this.cronJobs.has('autoDeclare') && this.cronJobs.get('autoDeclare')?.getStatus() === 'scheduled',
        schedule: '*/10 * * * * *'
      },
      timestamp: new Date().toISOString()
    };
  }

  private async startAutoDeclareCronJob(): Promise<void> {
    if (this.cronJobs.has('autoDeclare')) {
      this.cronJobs.get('autoDeclare')?.stop();
      this.cronJobs.delete('autoDeclare');
    }

    const autoDeclareJob = cron.schedule('*/10 * * * * *', async () => {
      if (this.isJobRunning) {
        return;
      }

      this.isJobRunning = true;
      try {
        await this.autoDeclareService.runAutoDeclareJob();
      } catch (error) {
        log('Error running auto declare job:', error);
      } finally {
        this.isJobRunning = false;
      }
    });

    this.cronJobs.set('autoDeclare', autoDeclareJob);
    autoDeclareJob.start();
  }

  private stopAutoDeclareCronJob(): void {
    if (this.cronJobs.has('autoDeclare')) {
      this.cronJobs.get('autoDeclare')?.stop();
      this.cronJobs.delete('autoDeclare');
    }
  }

  private async shutdown(): Promise<void> {
    for (const [, cronJob] of this.cronJobs) {
      try {
        cronJob.stop();
      } catch (error) {
        log('Error stopping cron job during shutdown:', error);
      }
    }

    this.cronJobs.clear();
  }
}

if (!isMainThread) {
  try {
    new AutoDeclareWorker();
  } catch (error) {
    log(`Failed to initialize worker: ${(error as Error).message}`);
  }
}

export default AutoDeclareWorker;
