// optimizedCronWorker.ts

import { isMainThread, parentPort } from 'worker_threads';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import OptimizedMatchService from '@/services/optimizedMatch.service';
import mongoose from 'mongoose';
import DB from '@/databases';


// Debug function for worker thread
function log(message: string, ...args: any[]) {
  logger.info(`[OptimizedCronWorker] ${message}`, ...args);
}

log('Optimized worker file loaded');

/**
 * OptimizedCronWorker class handles all cron job operations with performance optimizations
 * Includes proper connection management, job overlap prevention, and resource monitoring
 */
class OptimizedCronWorker {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private isReady = false;
  private matchService: OptimizedMatchService;
  private jobExecutionStatus: Map<string, { isRunning: boolean; lastExecution: number; executionCount: number }> = new Map();
  private performanceMetrics: Map<string, { totalTime: number; executions: number; errors: number }> = new Map();
  private memoryUsageInterval: NodeJS.Timeout | null = null;
  private connectionHealthInterval: NodeJS.Timeout | null = null;
  private lastMemoryCheck = 0;
  private readonly MAX_MEMORY_MB = 400;
  private readonly JOB_TIMEOUT_MS = 25000; // 25 seconds timeout for each job

  constructor() {
    log('Starting optimized constructor...');
    try {
      this.initializeWorker().catch(error => {
        log(`Failed in constructor: ${error.message}`);
      });
    } catch (error) {
      log(`Constructor error: ${(error as Error).message}`);
    }
  }

  /**
   * Initialize worker with enhanced connection management and monitoring
   */
  private async initializeWorker(): Promise<void> {
    try {
      log('Starting optimized initialization...');

      // Setup message handlers first
      this.setupMessageHandlers();

      // Establish database connection with retry logic
      await this.establishDatabaseConnection();

      // Initialize services
      this.matchService = new OptimizedMatchService();


      // Initialize job execution tracking
      this.initializeJobTracking();

      // Start monitoring
      this.startPerformanceMonitoring();

      // Mark as ready
      this.isReady = true;
      log('Optimized worker initialized successfully');

      // Send ready signal
      if (parentPort) {
        parentPort.postMessage({ type: 'WORKER_READY' });
        log('Sent WORKER_READY signal to main thread');
      }
    } catch (error) {
      log(`Failed to initialize optimized worker: ${(error as Error).message}`);
      this.isReady = false;
      throw error;
    }
  }

  /**
   * Establish database connection with retry logic and proper error handling
   */
  private async establishDatabaseConnection(): Promise<void> {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        log(`Attempting database connection (attempt ${retryCount + 1}/${maxRetries})...`);
        await DB();

        // Wait for connection to be ready
        await this.waitForDatabaseReady();

        log('Database connection established successfully');
        return;
      } catch (error) {
        retryCount++;
        log(`Database connection attempt ${retryCount} failed:`, error);

        if (retryCount >= maxRetries) {
          throw new Error(`Failed to establish database connection after ${maxRetries} attempts`);
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
      }
    }
  }

  /**
   * Wait for database to be ready
   */
  private async waitForDatabaseReady(): Promise<void> {
    const timeout = 30000; // 30 seconds
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (mongoose.connection.readyState === 1) {
        log('Database connection is ready');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Database connection timeout');
  }

  /**
   * Initialize job execution tracking
   */
  private initializeJobTracking(): void {
    const jobs = ['match'];

    jobs.forEach(job => {
      this.jobExecutionStatus.set(job, {
        isRunning: false,
        lastExecution: 0,
        executionCount: 0
      });

      this.performanceMetrics.set(job, {
        totalTime: 0,
        executions: 0,
        errors: 0
      });
    });
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Memory usage monitoring
    this.memoryUsageInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // Check every 30 seconds

    // Database connection health monitoring
    this.connectionHealthInterval = setInterval(() => {
      this.checkConnectionHealth();
    }, 60000); // Check every minute
  }

  /**
   * Check memory usage and log warnings
   */
  private checkMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const rssUsedMB = Math.round(memUsage.rss / 1024 / 1024);

    this.lastMemoryCheck = Date.now();

    if (heapUsedMB > this.MAX_MEMORY_MB) {
      log(`High memory usage detected: Heap ${heapUsedMB}MB, RSS ${rssUsedMB}MB`);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        log('Forced garbage collection');
      }
    }

    // Log memory stats every 5 minutes
    if (this.lastMemoryCheck % 300000 < 30000) {
      log(`Memory usage: Heap ${heapUsedMB}MB, RSS ${rssUsedMB}MB`);
    }
  }

  /**
   * Check database connection health
   */
  private checkConnectionHealth(): void {
    const state = mongoose.connection.readyState;
    const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting'];

    if (state !== 1) {
      log(`Database connection unhealthy: ${stateNames[state] || 'unknown'}`);
    }
  }

  /**
   * Execute job with overlap prevention and performance tracking
   */
  private async executeJobSafely(jobName: string, jobFunction: () => Promise<void>): Promise<void> {
    const jobStatus = this.jobExecutionStatus.get(jobName);
    const metrics = this.performanceMetrics.get(jobName);

    if (!jobStatus || !metrics) {
      log(`Job tracking not initialized for: ${jobName}`);
      return;
    }

    // Check if job is already running
    if (jobStatus.isRunning) {
      log(`Skipping ${jobName} - previous execution still running`);
      return;
    }

    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      log(`Skipping ${jobName} - database not connected`);
      return;
    }

    const startTime = Date.now();
    jobStatus.isRunning = true;
    jobStatus.executionCount++;

    try {
      // Set timeout for job execution
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Job ${jobName} timed out after ${this.JOB_TIMEOUT_MS}ms`));
        }, this.JOB_TIMEOUT_MS);
      });

      // Race between job execution and timeout
      await Promise.race([jobFunction(), timeoutPromise]);

      const executionTime = Date.now() - startTime;
      metrics.totalTime += executionTime;
      metrics.executions++;

      jobStatus.lastExecution = Date.now();

      // Log slow executions
      if (executionTime > 10000) {
        log(`Slow execution for ${jobName}: ${executionTime}ms`);
      }

    } catch (error) {
      metrics.errors++;
      log(`Error in ${jobName} job:`, error);

      // Don't throw error to prevent cron job from stopping
    } finally {
      jobStatus.isRunning = false;
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

    // Handle PING and HEALTH_CHECK messages
    if (type === 'PING' || type === 'HEALTH_CHECK') {
      if (this.isReady) {
        this.sendResponse(id, {
          success: true,
          message: 'Worker is ready',
          stats: this.getWorkerStats()
        });
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
          this.sendResponse(id, { success: false, error: `Failed to start match cron job: ${error.message}` });
        }
        break;

      case 'STOP_MATCH_CRON':
        try {
          this.stopMatchCronJob();
          this.sendResponse(id, { success: true, message: 'Match cron job stopped successfully' });
        } catch (error) {
          this.sendResponse(id, { success: false, error: `Failed to stop match cron job: ${error.message}` });
        }
        break;

      case 'GET_CRON_STATUS':
        const status = this.getCronJobsStatus();
        this.sendResponse(id, { success: true, data: status });
        break;

      case 'GET_PERFORMANCE_STATS':
        const stats = this.getPerformanceStats();
        this.sendResponse(id, { success: true, data: stats });
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
   * Start optimized match cron job
   */
  private async startMatchCronJob(): Promise<void> {
    try {
      // Stop existing match cron job if running
      if (this.cronJobs.has('match')) {
        this.cronJobs.get('match')?.stop();
        this.cronJobs.delete('match');
      }

      // Start new match cron job with overlap prevention
      const matchCronJob = cron.schedule('* * * * * *', async () => {
        await this.executeJobSafely('match', async () => {
          await this.matchService.runOptimizedCronJob();
        });
      });

      this.cronJobs.set('match', matchCronJob);
      matchCronJob.start();
      log('Optimized match cron job started successfully');
    } catch (error) {
      log('Failed to start optimized match cron job:', error);
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

        // Reset job status
        const jobStatus = this.jobExecutionStatus.get('match');
        if (jobStatus) {
          jobStatus.isRunning = false;
        }

        log('Match cron job stopped successfully');
      }
    } catch (error) {
      log('Failed to stop match cron job:', error);
      throw error;
    }
  }



  /**
   * Get status of all cron jobs with enhanced metrics
   */
  private getCronJobsStatus(): any {
    const status: any = {
      match: {
        isRunning: this.cronJobs.has('match') && this.cronJobs.get('match')?.getStatus() === 'scheduled',
        schedule: '* * * * * *',
        executionStatus: this.jobExecutionStatus.get('match'),
        metrics: this.performanceMetrics.get('match')
      },
      timestamp: new Date().toISOString(),
      databaseStatus: {
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name
      },
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };

    return status;
  }

  /**
   * Get performance statistics
   */
  private getPerformanceStats(): any {
    const stats: any = {
      jobs: {},
      memory: {
        current: process.memoryUsage(),
        lastCheck: this.lastMemoryCheck
      },
      database: {
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host
      },
      uptime: process.uptime()
    };

    // Add job-specific stats
    for (const [jobName, metrics] of this.performanceMetrics) {
      const executionStatus = this.jobExecutionStatus.get(jobName);
      stats.jobs[jobName] = {
        ...metrics,
        averageExecutionTime: metrics.executions > 0 ? metrics.totalTime / metrics.executions : 0,
        errorRate: metrics.executions > 0 ? metrics.errors / metrics.executions : 0,
        isCurrentlyRunning: executionStatus?.isRunning || false,
        lastExecution: executionStatus?.lastExecution || 0
      };
    }

    return stats;
  }

  /**
   * Get worker statistics
   */
  private getWorkerStats(): any {
    return {
      isReady: this.isReady,
      activeJobs: this.cronJobs.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      databaseConnected: mongoose.connection.readyState === 1
    };
  }

  /**
   * Shutdown worker and cleanup resources
   */
  private async shutdown(): Promise<void> {
    try {
      log('Shutting down optimized worker...');

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

      // Clear monitoring intervals
      if (this.memoryUsageInterval) {
        clearInterval(this.memoryUsageInterval);
        this.memoryUsageInterval = null;
      }

      if (this.connectionHealthInterval) {
        clearInterval(this.connectionHealthInterval);
        this.connectionHealthInterval = null;
      }

      // Close database connection
      try {
        await mongoose.connection.close();
        log('Database connection closed');
      } catch (error) {
        log('Error closing database connection:', error);
      }

      log('Optimized worker shutdown complete');
    } catch (error) {
      log(`Error during shutdown: ${(error as Error).message}`);
    }
  }
}

// Initialize worker if not in main thread
if (!isMainThread) {
  try {
    log('Starting optimized worker in worker thread');
    new OptimizedCronWorker();
    log('Optimized worker instance created successfully');
  } catch (error) {
    log(`Failed to initialize optimized worker: ${(error as Error).message}`);
  }
}

export default OptimizedCronWorker;