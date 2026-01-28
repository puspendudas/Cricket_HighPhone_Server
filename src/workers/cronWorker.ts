// cronWorker.ts

import { isMainThread, parentPort } from 'worker_threads';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import MatchService from '../services/match.service';
import AdminService from '../services/admin.service';
import MarketService from '../services/market.service';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
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
  private intervalId: NodeJS.Timeout | null = null;
  private isReady = false;
  private matchService: MatchService;
  private adminService: AdminService;
  private marketService: MarketService;

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
      this.adminService = new AdminService();
      this.marketService = new MarketService();

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

      case 'START_ADMIN_CRON':
        try {
          await this.startAdminCronJob();
          this.sendResponse(id, { success: true, message: 'Admin cron job started successfully' });
        } catch (error) {
          this.sendResponse(id, { success: false, message: `Failed to start admin cron job: ${error.message}` });
        }
        break;

      case 'START_AUTO_DECLARE':
        try {
          await this.startAutoDeclareJob();
          this.sendResponse(id, { success: true, message: 'Auto declare started successfully' });
        } catch (error) {
          this.sendResponse(id, { success: false, message: `Failed to start auto declare: ${error.message}` });
        }
        break;

      case 'STOP_AUTO_DECLARE':
        try {
          this.stopAutoDeclareJob();
          this.sendResponse(id, { success: true, message: 'Auto declare stopped successfully' });
        } catch (error) {
          this.sendResponse(id, { success: false, message: `Failed to stop auto declare: ${error.message}` });
        }
        break;

      case 'START_API_STATUS_CHECK':
        try {
          await this.startAPIStatusCheckJob();
          this.sendResponse(id, { success: true, message: 'API status check started successfully' });
        } catch (error) {
          this.sendResponse(id, { success: false, message: `Failed to start API status check: ${error.message}` });
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
      admin: {
        isRunning: this.cronJobs.has('admin') && this.cronJobs.get('admin')?.getStatus() === 'scheduled',
        schedule: 'Dynamic based on settings'
      },
      autoDeclare: {
        isRunning: this.cronJobs.has('autoDeclare') && this.cronJobs.get('autoDeclare')?.getStatus() === 'scheduled',
        schedule: '0 */30 * * * *' // Every 30 minutes
      },
      apiStatusCheck: {
        isRunning: this.cronJobs.has('apiStatusCheck') && this.cronJobs.get('apiStatusCheck')?.getStatus() === 'scheduled',
        schedule: '0 0 * * *' // Daily at midnight
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
   * Start admin cron job
   */
  private async startAdminCronJob(): Promise<void> {
    try {
      // Stop existing admin cron job if running
      if (this.cronJobs.has('admin')) {
        this.cronJobs.get('admin')?.stop();
        this.cronJobs.delete('admin');
      }

      // Start admin cron job
      await this.adminService.startCronJob();
      log('Admin cron job started successfully');
    } catch (error) {
      log('Failed to start admin cron job:', error);
      throw error;
    }
  }

  /**
   * Start auto declare job
   */
  private async startAutoDeclareJob(): Promise<void> {
    try {
      // Stop existing auto declare job if running
      if (this.cronJobs.has('autoDeclare')) {
        this.cronJobs.get('autoDeclare')?.stop();
        this.cronJobs.delete('autoDeclare');
      }

      // Start auto declare job - runs every 30 minutes
      const autoDeclareJob = cron.schedule('0 */30 * * * *', async () => {
        try {
          await this.marketService.autoDeclare();
          log('Auto declare executed successfully');
        } catch (error) {
          log('Error in auto declare job:', error);
        }
      });

      this.cronJobs.set('autoDeclare', autoDeclareJob);
      autoDeclareJob.start();
      log('Auto declare job started successfully');
    } catch (error) {
      log('Failed to start auto declare job:', error);
      throw error;
    }
  }

  /**
   * Stop auto declare job
   */
  private stopAutoDeclareJob(): void {
    try {
      if (this.cronJobs.has('autoDeclare')) {
        this.cronJobs.get('autoDeclare')?.stop();
        this.cronJobs.delete('autoDeclare');
        log('Auto declare job stopped successfully');
      }
    } catch (error) {
      log('Failed to stop auto declare job:', error);
      throw error;
    }
  }

  /**
   * Start API status check job
   */
  private async startAPIStatusCheckJob(): Promise<void> {
    try {
      // Stop existing API status check job if running
      if (this.cronJobs.has('apiStatusCheck')) {
        this.cronJobs.get('apiStatusCheck')?.stop();
        this.cronJobs.delete('apiStatusCheck');
      }

      // Start API status check job - runs daily at midnight
      const apiStatusCheckJob = cron.schedule('0 0 * * *', async () => {
        try {
          await this.checkAPIStatus();
          log('API status check executed successfully');
        } catch (error) {
          log('Error in API status check job:', error);
        }
      });

      this.cronJobs.set('apiStatusCheck', apiStatusCheckJob);
      apiStatusCheckJob.start();
      log('API status check job started successfully');
    } catch (error) {
      log('Failed to start API status check job:', error);
      throw error;
    }
  }

  /**
   * Check API status
   */
  private async checkAPIStatus(): Promise<void> {
    try {
      const currentDate = new Date().toISOString().split('T')[0];
      const randomNumber = uuidv4();

      const body = {
        date: currentDate,
        random: randomNumber
      };

      const response = await axios.post('https://terminal.hpterminal.com/cricket/status', body, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CricketApp/1.0'
        }
      });

      if (response.status === 201) {
        log('API status check passed - API is working');
      } else {
        log('API status check failed - unexpected response status:', response.status);
      }
    } catch (error) {
      log('API status check failed:', error);
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
