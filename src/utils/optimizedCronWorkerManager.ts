// optimizedCronWorkerManager.ts

import { Worker } from 'worker_threads';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '@utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * OptimizedCronWorkerManager handles communication with the cron worker thread
 * Includes performance optimizations and better resource management
 */
class OptimizedCronWorkerManager {
  private worker: Worker | null = null;
  private pendingMessages: Map<string, { 
    resolve: Function; 
    reject: Function; 
    timeout: NodeJS.Timeout;
    type?: string;
    timestamp: number;
  }> = new Map();
  private isInitialized = false;
  private readonly workerPath: string;
  private fallbackMode = false;
  private messageCleanupInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck = 0;
  private readonly MAX_PENDING_MESSAGES = 100;
  private readonly MESSAGE_TIMEOUT_MS = 30000;
  private readonly HEALTH_CHECK_INTERVAL_MS = 60000;

  constructor() {
    this.workerPath = path.join(__dirname, '../workers/optimizedCronWorker.ts');
    this.startMessageCleanup();
  }

  /**
   * Start periodic cleanup of stale pending messages
   */
  private startMessageCleanup(): void {
    this.messageCleanupInterval = setInterval(() => {
      this.cleanupStaleMessages();
    }, 30000); // Clean every 30 seconds
  }

  /**
   * Clean up stale pending messages to prevent memory leaks
   */
  private cleanupStaleMessages(): void {
    const now = Date.now();
    const staleThreshold = 60000; // 1 minute
    
    for (const [id, pendingMessage] of this.pendingMessages) {
      if (now - pendingMessage.timestamp > staleThreshold) {
        clearTimeout(pendingMessage.timeout);
        pendingMessage.reject(new Error('Message timeout - cleaned up'));
        this.pendingMessages.delete(id);
        logger.warn(`Cleaned up stale message: ${id}`);
      }
    }

    // Log if too many pending messages
    if (this.pendingMessages.size > this.MAX_PENDING_MESSAGES) {
      logger.warn(`High number of pending messages: ${this.pendingMessages.size}`);
    }
  }

  /**
   * Initialize the worker thread with better error handling and resource management
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('OptimizedCronWorkerManager: Already initialized');
      return;
    }

    try {
      // Try both .ts and .js files
      let workerPath = path.join(__dirname, '../workers/optimizedCronWorker.ts');
      if (!fs.existsSync(workerPath)) {
        workerPath = path.join(__dirname, '../workers/optimizedCronWorker.js');
        logger.info(`OptimizedCronWorkerManager: .ts file not found, trying .js file`);
      }
      
      logger.info(`OptimizedCronWorkerManager: Starting worker at path: ${workerPath}`);
      
      this.worker = new Worker(workerPath, {
        execArgv: [
          '--require', 'ts-node/register',
          '--require', 'tsconfig-paths/register',
          '--require', 'reflect-metadata',
          '--max-old-space-size=512' // Limit memory usage
        ],
        resourceLimits: {
          maxOldGenerationSizeMb: 512,
          maxYoungGenerationSizeMb: 128
        }
      });

      // Setup message handler
      this.worker.on('message', (message) => {
        this.handleWorkerMessage(message);
      });

      // Setup error handler
      this.worker.on('error', (error) => {
        logger.error('OptimizedCronWorkerManager: Worker error:', error);
        this.handleWorkerError(error);
      });

      // Setup exit handler
      this.worker.on('exit', (code) => {
        if (code !== 0) {
          logger.error(`OptimizedCronWorkerManager: Worker stopped with exit code ${code}`);
        } else {
          logger.info('OptimizedCronWorkerManager: Worker exited gracefully');
        }
        this.cleanup();
      });

      // Add online event handler
      this.worker.on('online', () => {
        logger.info('OptimizedCronWorkerManager: Worker thread is online');
      });

      // Wait for worker to be ready
      await this.waitForWorkerReady();
      
      this.isInitialized = true;
      this.startHealthCheck();
      logger.info('OptimizedCronWorkerManager: Worker thread initialized successfully');
    } catch (error) {
      logger.error('OptimizedCronWorkerManager: Failed to initialize worker:', error);
      logger.warn('OptimizedCronWorkerManager: Falling back to non-worker mode');
      this.fallbackMode = true;
      this.isInitialized = true;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, this.HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Perform health check on worker
   */
  private async performHealthCheck(): Promise<void> {
    if (this.fallbackMode || !this.worker || !this.isInitialized) {
      return;
    }

    try {
      const start = Date.now();
      await this.sendMessage('HEALTH_CHECK', null, 10000);
      const duration = Date.now() - start;
      this.lastHealthCheck = Date.now();
      
      if (duration > 5000) {
        logger.warn(`Worker health check slow: ${duration}ms`);
      }
    } catch (error) {
      logger.error('Worker health check failed:', error);
      // Consider restarting worker if health checks consistently fail
    }
  }

  /**
   * Wait for worker to be ready with improved timeout handling
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
      
      // Give the worker time to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ping the worker to ensure it's ready
      await this.sendMessage('PING', null, 20000);
      logger.info('OptimizedCronWorkerManager: Worker is ready and responding');
    } catch (error) {
      logger.error('OptimizedCronWorkerManager: Worker initialization failed:', error);
      throw new Error('Worker failed to initialize properly');
    }
  }

  /**
   * Handle messages from worker thread with improved error handling
   */
  private handleWorkerMessage(message: any): void {
    const { id, success, data, error, critical, type } = message;

    // Handle WORKER_READY signal
    if (type === 'WORKER_READY') {
      logger.info('OptimizedCronWorkerManager: Received WORKER_READY signal from worker');
      // Find any pending PING message and resolve it
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

    // Handle critical errors
    if (critical) {
      logger.error('OptimizedCronWorkerManager: Critical error from worker:', error);
      if (error === 'API access forbidden') {
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
   * Handle worker errors with cleanup
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
   * Send message to worker thread with improved timeout and queue management
   */
  private async sendMessage(type: string, data?: any, timeoutMs = this.MESSAGE_TIMEOUT_MS): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker not available');
    }
    
    if (!this.isInitialized && type !== 'PING') {
      throw new Error('Worker not initialized');
    }

    // Check if too many pending messages
    if (this.pendingMessages.size >= this.MAX_PENDING_MESSAGES) {
      throw new Error('Too many pending messages - worker may be overloaded');
    }

    const messageId = uuidv4();
    const message = { id: messageId, type, data };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error(`Worker message timeout for type: ${type} after ${timeoutMs}ms`));
      }, timeoutMs);

      // Store pending message with timestamp
      this.pendingMessages.set(messageId, { 
        resolve, 
        reject, 
        timeout, 
        type,
        timestamp: Date.now()
      });

      // Send message to worker
      if (!this.worker) {
        throw new Error('Worker not available');
      }
      this.worker.postMessage(message);
    });
  }

  /**
   * Start match cron job with better error handling
   */
  public async startMatchCronJob(): Promise<void> {
    if (this.fallbackMode) {
      logger.warn('OptimizedCronWorkerManager: Running in fallback mode - match cron job disabled');
      return;
    }
    
    try {
      const result = await this.sendMessage('START_MATCH_CRON');
      logger.info('OptimizedCronWorkerManager: Match cron job started successfully');
      return result;
    } catch (error) {
      logger.error('OptimizedCronWorkerManager: Failed to start match cron job:', error);
      throw error;
    }
  }

  /**
   * Stop match cron job
   */
  public async stopMatchCronJob(): Promise<void> {
    if (this.fallbackMode) {
      return;
    }
    
    try {
      const result = await this.sendMessage('STOP_MATCH_CRON');
      logger.info('OptimizedCronWorkerManager: Match cron job stopped successfully');
      return result;
    } catch (error) {
      logger.error('OptimizedCronWorkerManager: Failed to stop match cron job:', error);
      throw error;
    }
  }

  /**
   * Get status of all cron jobs
   */
  public async getCronJobsStatus(): Promise<any> {
    if (this.fallbackMode) {
      return {
        match: { isRunning: false, schedule: 'Disabled - fallback mode' },
        admin: { isRunning: false, schedule: 'Disabled - fallback mode' },
        timestamp: new Date().toISOString(),
        fallbackMode: true,
        pendingMessages: 0,
        lastHealthCheck: null
      };
    }
    
    try {
      const result = await this.sendMessage('GET_CRON_STATUS');
      return {
        ...result.data,
        pendingMessages: this.pendingMessages.size,
        lastHealthCheck: this.lastHealthCheck
      };
    } catch (error) {
      logger.error('OptimizedCronWorkerManager: Failed to get cron jobs status:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources with improved cleanup
   */
  private cleanup(): void {
    this.isInitialized = false;
    
    // Clear all pending messages
    for (const [, pendingMessage] of this.pendingMessages) {
      clearTimeout(pendingMessage.timeout);
      pendingMessage.reject(new Error('Worker terminated'));
    }
    this.pendingMessages.clear();

    // Clear intervals
    if (this.messageCleanupInterval) {
      clearInterval(this.messageCleanupInterval);
      this.messageCleanupInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Shutdown worker thread with improved cleanup
   */
  public async shutdown(): Promise<void> {
    if (this.fallbackMode || !this.worker || !this.isInitialized) {
      logger.warn('OptimizedCronWorkerManager: Worker not initialized or in fallback mode, nothing to shutdown');
      this.cleanup();
      return;
    }

    try {
      // Send shutdown message to worker
      await this.sendMessage('SHUTDOWN', null, 10000);
      
      // Terminate worker
      await this.worker.terminate();
      
      logger.info('OptimizedCronWorkerManager: Worker shutdown completed');
    } catch (error) {
      logger.error('OptimizedCronWorkerManager: Error during shutdown:', error);
      
      // Force terminate if graceful shutdown fails
      if (this.worker) {
        await this.worker.terminate();
      }
    } finally {
      this.worker = null;
      this.cleanup();
    }
  }

  /**
   * Get worker statistics
   */
  public getWorkerStats(): any {
    return {
      isInitialized: this.isInitialized,
      fallbackMode: this.fallbackMode,
      pendingMessages: this.pendingMessages.size,
      lastHealthCheck: this.lastHealthCheck,
      workerExists: !!this.worker
    };
  }

  /**
   * Get comprehensive worker health information
   */
  public getWorkerHealth(): any {
    const now = Date.now();
    const timeSinceLastHealthCheck = this.lastHealthCheck ? now - this.lastHealthCheck : null;
    
    // Determine health status
    let healthStatus = 'unknown';
    if (this.fallbackMode) {
      healthStatus = 'fallback';
    } else if (!this.isInitialized || !this.worker) {
      healthStatus = 'unhealthy';
    } else if (timeSinceLastHealthCheck && timeSinceLastHealthCheck > this.HEALTH_CHECK_INTERVAL_MS * 2) {
      healthStatus = 'stale';
    } else if (this.pendingMessages.size > this.MAX_PENDING_MESSAGES * 0.8) {
      healthStatus = 'degraded';
    } else {
      healthStatus = 'healthy';
    }

    // Calculate pending message statistics
    const pendingMessageTypes: { [key: string]: number } = {};
    let oldestPendingMessage = 0;
    
    for (const [, pendingMessage] of this.pendingMessages) {
      const type = pendingMessage.type || 'unknown';
      pendingMessageTypes[type] = (pendingMessageTypes[type] || 0) + 1;
      
      const messageAge = now - pendingMessage.timestamp;
      if (messageAge > oldestPendingMessage) {
        oldestPendingMessage = messageAge;
      }
    }

    return {
      status: healthStatus,
      timestamp: new Date().toISOString(),
      worker: {
        isInitialized: this.isInitialized,
        exists: !!this.worker,
        fallbackMode: this.fallbackMode
      },
      health: {
        lastHealthCheck: this.lastHealthCheck ? new Date(this.lastHealthCheck).toISOString() : null,
        timeSinceLastHealthCheck: timeSinceLastHealthCheck,
        healthCheckInterval: this.HEALTH_CHECK_INTERVAL_MS,
        isHealthCheckOverdue: timeSinceLastHealthCheck ? timeSinceLastHealthCheck > this.HEALTH_CHECK_INTERVAL_MS * 1.5 : false
      },
      messages: {
        pending: this.pendingMessages.size,
        maxPending: this.MAX_PENDING_MESSAGES,
        utilizationPercent: Math.round((this.pendingMessages.size / this.MAX_PENDING_MESSAGES) * 100),
        oldestPendingMessageAge: oldestPendingMessage,
        pendingByType: pendingMessageTypes,
        messageTimeout: this.MESSAGE_TIMEOUT_MS
      },
      alerts: this.generateHealthAlerts(healthStatus, timeSinceLastHealthCheck, oldestPendingMessage),
      recommendations: this.generateHealthRecommendations(healthStatus)
    };
  }

  /**
   * Generate health alerts based on current status
   */
  private generateHealthAlerts(healthStatus: string, timeSinceLastHealthCheck: number | null, oldestPendingMessage: number): any[] {
    const alerts: any[] = [];
    
    if (healthStatus === 'unhealthy') {
      alerts.push({
        level: 'critical',
        message: 'Worker is not initialized or does not exist',
        timestamp: new Date().toISOString()
      });
    }
    
    if (healthStatus === 'fallback') {
      alerts.push({
        level: 'warning',
        message: 'Worker is running in fallback mode',
        timestamp: new Date().toISOString()
      });
    }
    
    if (timeSinceLastHealthCheck && timeSinceLastHealthCheck > this.HEALTH_CHECK_INTERVAL_MS * 2) {
      alerts.push({
        level: 'warning',
        message: `Health check is overdue by ${Math.round((timeSinceLastHealthCheck - this.HEALTH_CHECK_INTERVAL_MS) / 1000)}s`,
        timestamp: new Date().toISOString()
      });
    }
    
    if (this.pendingMessages.size > this.MAX_PENDING_MESSAGES * 0.9) {
      alerts.push({
        level: 'critical',
        message: `High number of pending messages: ${this.pendingMessages.size}/${this.MAX_PENDING_MESSAGES}`,
        timestamp: new Date().toISOString()
      });
    } else if (this.pendingMessages.size > this.MAX_PENDING_MESSAGES * 0.7) {
      alerts.push({
        level: 'warning',
        message: `Elevated number of pending messages: ${this.pendingMessages.size}/${this.MAX_PENDING_MESSAGES}`,
        timestamp: new Date().toISOString()
      });
    }
    
    if (oldestPendingMessage > this.MESSAGE_TIMEOUT_MS * 0.8) {
      alerts.push({
        level: 'warning',
        message: `Old pending message detected: ${Math.round(oldestPendingMessage / 1000)}s old`,
        timestamp: new Date().toISOString()
      });
    }
    
    return alerts;
  }

  /**
   * Generate health recommendations based on current status
   */
  private generateHealthRecommendations(healthStatus: string): string[] {
    const recommendations: string[] = [];
    
    if (healthStatus === 'unhealthy') {
      recommendations.push('Restart the worker thread');
      recommendations.push('Check worker thread logs for errors');
    }
    
    if (healthStatus === 'fallback') {
      recommendations.push('Investigate why worker thread failed to initialize');
      recommendations.push('Check system resources and dependencies');
    }
    
    if (healthStatus === 'degraded') {
      recommendations.push('Monitor worker performance closely');
      recommendations.push('Consider reducing worker load');
    }
    
    if (this.pendingMessages.size > this.MAX_PENDING_MESSAGES * 0.5) {
      recommendations.push('Reduce message frequency to worker');
      recommendations.push('Investigate slow worker responses');
    }
    
    if (healthStatus === 'healthy' && recommendations.length === 0) {
      recommendations.push('Worker is operating normally');
    }
    
    return recommendations;
  }
}

export default OptimizedCronWorkerManager;