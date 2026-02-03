// cronWorker.ts

import { isMainThread, parentPort } from 'worker_threads';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import MatchService from '../services/match.service';
import DB from '../databases';


// Debug function for worker thread
function log(message: string, ...args: any[]) {
  logger.info(`[CronWorker] ${message}`, ...args);
}

log('Worker file loaded');

/**
 * CronWorker class handles all cron job operations in a separate worker thread
 * This approach prevents blocking the main application thread
 */
class CronWorker {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private isReady = false;
  private matchService: MatchService;


  constructor() {
    log('Starting constructor...');
    try {
      log('Initializing worker...');
      this.initializeWorker().catch(error => {
        log(`Failed in constructor: ${error.message}`);
      });
    } catch (error) {
      log(`Constructor error: ${(error as Error).message}`);
    }
  }

  /**
   * Initialize worker with message handlers
   */
  private async initializeWorker(): Promise<void> {
    try {
      log('Starting initialization...');

      // Setup message handlers first
      this.setupMessageHandlers();

      // Establish database connection for worker thread
      log('Connecting to database...');
      await DB();
      log('Database connection established');

      // Wait a moment for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Initialize services
      this.matchService = new MatchService();


      // Mark as ready after everything is initialized
      this.isReady = true;
      log('Worker initialized successfully');

      // Send a ready signal to main thread
      if (parentPort) {
        parentPort.postMessage({ type: 'WORKER_READY' });
        log('Sent WORKER_READY signal to main thread');
      }
    } catch (error) {
      log(`Failed to initialize worker: ${(error as Error).message}`);
      this.isReady = false;
    }
  }

  /**
   * Setup message handlers for communication with main thread
   */
  private setupMessageHandlers(): void {
    try {
      if (!isMainThread && parentPort) {
        parentPort.on('message', async (message) => {
          try {
            await this.handleMessage(message);
          } catch (error) {
            log(`Error handling message: ${(error as Error).message}`);
            this.sendResponse(message.id, { success: false, error: (error as Error).message });
          }
        });
        log('Message handlers setup complete');
      } else {
        log('Not in worker thread or no parentPort available');
      }
    } catch (error) {
      log(`Failed to setup message handlers: ${(error as Error).message}`);
    }
  }

  /**
   * Handle incoming messages from main thread
   */
  private async handleMessage(message: any): Promise<void> {
    const { type, id } = message;

    log(`Handling message: ${type}`);

    // Handle PING messages only when ready
    if (type === 'PING') {
      if (this.isReady) {
        this.sendResponse(id, {
          success: true,
          message: 'Worker is ready'
        });
        log('Responded to PING - worker is ready');
      } else {
        log('PING received but worker not ready yet');
        // Don't respond to PING until fully initialized
      }
      return;
    }

    // For other messages, check if worker is ready
    if (!this.isReady) {
      this.sendResponse(id, {
        success: false,
        error: 'Worker is still initializing. Please try again.'
      });
      return;
    }

    switch (type) {
      case 'START_MATCH_CRON':
        try {
          await this.startMatchCronJob();
          this.sendResponse(id, { success: true, message: 'Match cron job started successfully' });
        } catch (error) {
          this.sendResponse(id, { success: false, message: `Failed to start match cron job: ${error.message}` });
        }
        break;

      case 'STOP_MATCH_CRON':
        try {
          this.stopMatchCronJob();
          this.sendResponse(id, { success: true, message: 'Match cron job stopped successfully' });
        } catch (error) {
          this.sendResponse(id, { success: false, message: `Failed to stop match cron job: ${error.message}` });
        }
        break;

      case 'GET_CRON_STATUS':
        const status = this.getCronJobsStatus();
        this.sendResponse(id, { success: true, data: status });
        break;

      case 'SHUTDOWN':
        await this.shutdown();
        this.sendResponse(id, { success: true, message: 'Worker shutdown complete' });
        break;

      default:
        log(`Unknown message type: ${type}`);
        this.sendResponse(id, { success: false, error: 'Unknown message type' });
    }
  }

  /**
   * Send response back to main thread
   */
  private sendResponse(messageId: string, response: any): void {
    if (!isMainThread && parentPort) {
      parentPort.postMessage({ id: messageId, ...response });
    }
  }

  /**
   * Get status of all cron jobs
   */
  private getCronJobsStatus(): any {
    return {
      match: {
        isRunning: this.cronJobs.has('match') && this.cronJobs.get('match')?.getStatus() === 'scheduled',
        schedule: '* * * * * *' // Every second
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Start match cron job
   */
  private async startMatchCronJob(): Promise<void> {
    try {
      // Stop existing match cron job if running
      if (this.cronJobs.has('match')) {
        this.cronJobs.get('match')?.stop();
        this.cronJobs.delete('match');
      }

      // Start new match cron job
      const matchCronJob = cron.schedule('* * * * * *', async () => {
        try {
          await this.matchService.runCronJob();
        } catch (error) {
          log('Error in match cron job:', error);
        }
      });

      this.cronJobs.set('match', matchCronJob);
      matchCronJob.start();
      log('Match cron job started successfully');
    } catch (error) {
      log('Failed to start match cron job:', error);
      throw error;
    }
  }

  /**
   * Stop match cron job
   */
  private stopMatchCronJob(): void {
    try {
      if (this.cronJobs.has('match')) {
        this.cronJobs.get('match')?.stop();
        this.cronJobs.delete('match');
        log('Match cron job stopped successfully');
      }
    } catch (error) {
      log('Failed to stop match cron job:', error);
      throw error;
    }
  }



  /**
   * Shutdown worker and cleanup resources
   */
  private async shutdown(): Promise<void> {
    try {
      log('Shutting down...');

      // Stop all cron jobs
      for (const [jobName, cronJob] of this.cronJobs) {
        try {
          cronJob.stop();
          log(`Stopped cron job: ${jobName}`);
        } catch (error) {
          log(`Error stopping cron job ${jobName}:`, error);
        }
      }

      // Clear all cron jobs
      this.cronJobs.clear();

      log('Shutdown complete');
    } catch (error) {
      log(`Error during shutdown: ${(error as Error).message}`);
    }
  }
}

// Initialize worker if not in main thread
if (!isMainThread) {
  try {
    log('Starting in worker thread');
    new CronWorker();
    log('Worker instance created successfully');
  } catch (error) {
    log(`Failed to initialize worker: ${(error as Error).message}`);
    log('Continuing anyway to allow graceful error handling');
    // Don't exit - let the worker stay alive to handle messages
    // The worker will respond with appropriate error messages
  }
}

export default CronWorker;
