// migrationHelper.ts

import { logger } from './logger';
import CronWorkerManager from '@/utils/cronWorkerManager';
import OptimizedCronWorkerManager from '@/utils/optimizedCronWorkerManager';
import MonitoringService from '@/services/monitoring.service';
import { getConnectionHealth } from '@/databases/optimizedIndex';
import fs from 'fs';
import path from 'path';

/**
 * MigrationHelper assists in transitioning from the current cron worker to the optimized version
 * Provides utilities for safe migration, rollback, and performance comparison
 */
class MigrationHelper {
  private static instance: MigrationHelper;
  private currentManager: CronWorkerManager | null = null;
  private optimizedManager: OptimizedCronWorkerManager | null = null;
  private monitoringService: MonitoringService;
  private migrationState: 'not_started' | 'in_progress' | 'completed' | 'rolled_back' = 'not_started';
  private migrationStartTime = 0;
  private performanceComparison: any = null;

  private constructor() {
    this.monitoringService = MonitoringService.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MigrationHelper {
    if (!MigrationHelper.instance) {
      MigrationHelper.instance = new MigrationHelper();
    }
    return MigrationHelper.instance;
  }

  /**
   * Initialize migration process
   */
  public async initializeMigration(currentManager: CronWorkerManager): Promise<void> {
    try {
      logger.info('[MigrationHelper] Initializing migration to optimized cron worker...');
      
      this.currentManager = currentManager;
      this.migrationState = 'in_progress';
      this.migrationStartTime = Date.now();
      
      // Create backup of current state
      await this.createBackup();
      
      // Validate current system health
      await this.validateSystemHealth();
      
      logger.info('[MigrationHelper] Migration initialization completed');
      
    } catch (error) {
      logger.error('[MigrationHelper] Failed to initialize migration:', error);
      throw error;
    }
  }

  /**
   * Perform gradual migration to optimized worker
   */
  public async performGradualMigration(): Promise<void> {
    try {
      logger.info('[MigrationHelper] Starting gradual migration...');
      
      if (!this.currentManager) {
        throw new Error('Current manager not initialized');
      }

      // Step 1: Get current cron job status
      const currentStatus = await this.getCurrentCronStatus();
      logger.info('[MigrationHelper] Current cron job status:', currentStatus);

      // Step 2: Initialize optimized manager
      logger.info('[MigrationHelper] Initializing optimized cron worker manager...');
      this.optimizedManager = new OptimizedCronWorkerManager();
      await this.optimizedManager.initialize();

      // Step 3: Wait for optimized worker to be ready
      await this.waitForOptimizedWorkerReady();

      // Step 4: Gradually transfer cron jobs
      await this.transferCronJobs(currentStatus);

      // Step 5: Monitor performance for a period
      await this.monitorPerformance();

      // Step 6: Complete migration
      await this.completeMigration();

      logger.info('[MigrationHelper] Gradual migration completed successfully');
      
    } catch (error) {
      logger.error('[MigrationHelper] Gradual migration failed:', error);
      await this.rollbackMigration();
      throw error;
    }
  }

  /**
   * Get current cron job status
   */
  private async getCurrentCronStatus(): Promise<any> {
    try {
      if (!this.currentManager) {
        throw new Error('Current manager not available');
      }

      const status = await this.currentManager.getCronJobsStatus();
      return status;
    } catch (error) {
      logger.error('[MigrationHelper] Failed to get current cron status:', error);
      return null;
    }
  }

  /**
   * Wait for optimized worker to be ready
   */
  private async waitForOptimizedWorkerReady(): Promise<void> {
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        if (this.optimizedManager) {
          const health = await this.optimizedManager.getWorkerHealth();
          if (health.isReady) {
            logger.info('[MigrationHelper] Optimized worker is ready');
            return;
          }
        }
      } catch (error) {
        // Continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Optimized worker failed to become ready within timeout');
  }

  /**
   * Transfer cron jobs from current to optimized manager
   */
  private async transferCronJobs(currentStatus: any): Promise<void> {
    try {
      logger.info('[MigrationHelper] Starting cron job transfer...');
      
      if (!this.currentManager || !this.optimizedManager) {
        throw new Error('Managers not available for transfer');
      }

      // Stop current cron jobs gracefully
      if (currentStatus?.match?.isRunning) {
        logger.info('[MigrationHelper] Stopping current match cron job...');
        await this.currentManager.stopMatchCronJob();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for graceful stop
      }

      if (currentStatus?.admin?.isRunning) {
        logger.info('[MigrationHelper] Stopping current admin cron job...');
        // Admin cron jobs are typically one-time, so we just note the state
      }

      // Start optimized cron jobs
      logger.info('[MigrationHelper] Starting optimized match cron job...');
      await this.optimizedManager.startMatchCronJob();

      // Verify the transfer
      await this.verifyTransfer();
      
      logger.info('[MigrationHelper] Cron job transfer completed');
      
    } catch (error) {
      logger.error('[MigrationHelper] Failed to transfer cron jobs:', error);
      throw error;
    }
  }

  /**
   * Verify that the transfer was successful
   */
  private async verifyTransfer(): Promise<void> {
    try {
      if (!this.optimizedManager) {
        throw new Error('Optimized manager not available');
      }

      // Wait a bit for jobs to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      const optimizedStatus = await this.optimizedManager.getCronJobsStatus();
      
      if (!optimizedStatus?.match?.isRunning) {
        throw new Error('Optimized match cron job is not running after transfer');
      }

      logger.info('[MigrationHelper] Transfer verification successful');
      
    } catch (error) {
      logger.error('[MigrationHelper] Transfer verification failed:', error);
      throw error;
    }
  }

  /**
   * Monitor performance during migration
   */
  private async monitorPerformance(): Promise<void> {
    try {
      logger.info('[MigrationHelper] Starting performance monitoring...');
      
      const monitoringDuration = 60000; // 1 minute
      const startTime = Date.now();
      const performanceData: any[] = [];

      while (Date.now() - startTime < monitoringDuration) {
        const healthReport = this.monitoringService.getHealthReport();
        const connectionHealth = getConnectionHealth();
        
        performanceData.push({
          timestamp: Date.now(),
          memory: healthReport.system.currentMemoryMB,
          databaseConnections: connectionHealth.poolSize.current,
          cronJobErrors: healthReport.cronJobs.errorRate,
          alerts: healthReport.alerts.total
        });
        
        await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
      }

      this.performanceComparison = this.analyzePerformanceData(performanceData);
      logger.info('[MigrationHelper] Performance monitoring completed:', this.performanceComparison);
      
    } catch (error) {
      logger.error('[MigrationHelper] Performance monitoring failed:', error);
    }
  }

  /**
   * Analyze performance data
   */
  private analyzePerformanceData(data: any[]): any {
    try {
      if (data.length === 0) {
        return { status: 'no_data' };
      }

      const avgMemory = data.reduce((sum, d) => sum + d.memory, 0) / data.length;
      const maxMemory = Math.max(...data.map(d => d.memory));
      const avgConnections = data.reduce((sum, d) => sum + d.databaseConnections, 0) / data.length;
      const totalErrors = data.reduce((sum, d) => sum + d.cronJobErrors, 0);
      const totalAlerts = Math.max(...data.map(d => d.alerts));

      const analysis = {
        averageMemoryMB: Math.round(avgMemory),
        peakMemoryMB: maxMemory,
        averageConnections: Math.round(avgConnections),
        totalErrors: totalErrors,
        totalAlerts: totalAlerts,
        status: 'analyzed',
        recommendation: this.generatePerformanceRecommendation(avgMemory, maxMemory, totalErrors, totalAlerts)
      };

      return analysis;
    } catch (error) {
      logger.error('[MigrationHelper] Error analyzing performance data:', error);
      return { status: 'analysis_failed', error: error.message };
    }
  }

  /**
   * Generate performance recommendation
   */
  private generatePerformanceRecommendation(avgMemory: number, maxMemory: number, errors: number, alerts: number): string {
    if (errors > 0) {
      return 'ROLLBACK_RECOMMENDED - Errors detected during migration';
    }
    
    if (alerts > 5) {
      return 'MONITOR_CLOSELY - Multiple alerts generated';
    }
    
    if (maxMemory > 400) {
      return 'MONITOR_MEMORY - High memory usage detected';
    }
    
    if (avgMemory < 200 && errors === 0 && alerts <= 2) {
      return 'MIGRATION_SUCCESSFUL - Performance improved';
    }
    
    return 'CONTINUE_MONITORING - Performance stable';
  }

  /**
   * Complete the migration
   */
  private async completeMigration(): Promise<void> {
    try {
      logger.info('[MigrationHelper] Completing migration...');
      
      // Shutdown current manager
      if (this.currentManager) {
        await this.currentManager.shutdown();
        this.currentManager = null;
      }

      // Update migration state
      this.migrationState = 'completed';
      
      // Save migration report
      await this.saveMigrationReport();
      
      logger.info('[MigrationHelper] Migration completed successfully');
      
    } catch (error) {
      logger.error('[MigrationHelper] Failed to complete migration:', error);
      throw error;
    }
  }

  /**
   * Rollback migration if something goes wrong
   */
  public async rollbackMigration(): Promise<void> {
    try {
      logger.warn('[MigrationHelper] Starting migration rollback...');
      
      // Stop optimized manager if running
      if (this.optimizedManager) {
        await this.optimizedManager.shutdown();
        this.optimizedManager = null;
      }

      // Restart current manager if available
      if (this.currentManager) {
        // Restore previous cron job state from backup
        await this.restoreFromBackup();
      }

      this.migrationState = 'rolled_back';
      
      logger.info('[MigrationHelper] Migration rollback completed');
      
    } catch (error) {
      logger.error('[MigrationHelper] Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Create backup of current state
   */
  private async createBackup(): Promise<void> {
    try {
      const backupData = {
        timestamp: Date.now(),
        cronJobStatus: await this.getCurrentCronStatus(),
        systemHealth: this.monitoringService.getHealthReport(),
        connectionHealth: getConnectionHealth()
      };

      const backupPath = path.join(process.cwd(), 'migration_backup.json');
      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
      
      logger.info(`[MigrationHelper] Backup created at: ${backupPath}`);
    } catch (error) {
      logger.error('[MigrationHelper] Failed to create backup:', error);
    }
  }

  /**
   * Restore from backup
   */
  private async restoreFromBackup(): Promise<void> {
    try {
      const backupPath = path.join(process.cwd(), 'migration_backup.json');
      
      if (fs.existsSync(backupPath)) {
        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        
        // Restore cron job state
        if (backupData.cronJobStatus?.match?.isRunning && this.currentManager) {
          await this.currentManager.startMatchCronJob();
        }
        
        logger.info('[MigrationHelper] Restored from backup');
      }
    } catch (error) {
      logger.error('[MigrationHelper] Failed to restore from backup:', error);
    }
  }

  /**
   * Validate system health before migration
   */
  private async validateSystemHealth(): Promise<void> {
    try {
      const healthReport = this.monitoringService.getHealthReport();
      
      // Check for critical issues
      if (healthReport.alerts.critical > 0) {
        throw new Error('Critical alerts detected - migration not recommended');
      }
      
      if (healthReport.system.currentMemoryMB > 400) {
        logger.warn('[MigrationHelper] High memory usage detected before migration');
      }
      
      if (healthReport.database.connectionState !== 'connected') {
        throw new Error('Database not connected - migration cannot proceed');
      }
      
      logger.info('[MigrationHelper] System health validation passed');
    } catch (error) {
      logger.error('[MigrationHelper] System health validation failed:', error);
      throw error;
    }
  }

  /**
   * Save migration report
   */
  private async saveMigrationReport(): Promise<void> {
    try {
      const report = {
        migrationId: `migration_${Date.now()}`,
        startTime: this.migrationStartTime,
        endTime: Date.now(),
        duration: Date.now() - this.migrationStartTime,
        status: this.migrationState,
        performanceComparison: this.performanceComparison,
        finalHealthReport: this.monitoringService.getHealthReport(),
        recommendations: this.generateFinalRecommendations()
      };

      const reportPath = path.join(process.cwd(), `migration_report_${Date.now()}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      logger.info(`[MigrationHelper] Migration report saved at: ${reportPath}`);
    } catch (error) {
      logger.error('[MigrationHelper] Failed to save migration report:', error);
    }
  }

  /**
   * Generate final recommendations
   */
  private generateFinalRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.performanceComparison?.recommendation === 'MIGRATION_SUCCESSFUL') {
      recommendations.push('Migration completed successfully with improved performance');
      recommendations.push('Continue monitoring system health for the next 24 hours');
    } else if (this.performanceComparison?.recommendation === 'ROLLBACK_RECOMMENDED') {
      recommendations.push('Consider investigating the errors before attempting migration again');
    } else {
      recommendations.push('Monitor system performance closely');
      recommendations.push('Consider fine-tuning optimized worker parameters');
    }
    
    return recommendations;
  }

  /**
   * Get migration status
   */
  public getMigrationStatus(): any {
    return {
      state: this.migrationState,
      startTime: this.migrationStartTime,
      duration: this.migrationStartTime > 0 ? Date.now() - this.migrationStartTime : 0,
      performanceComparison: this.performanceComparison,
      hasOptimizedManager: !!this.optimizedManager,
      hasCurrentManager: !!this.currentManager
    };
  }

  /**
   * Force cleanup of all resources
   */
  public async cleanup(): Promise<void> {
    try {
      if (this.optimizedManager) {
        await this.optimizedManager.shutdown();
        this.optimizedManager = null;
      }
      
      if (this.currentManager) {
        await this.currentManager.shutdown();
        this.currentManager = null;
      }
      
      logger.info('[MigrationHelper] Cleanup completed');
    } catch (error) {
      logger.error('[MigrationHelper] Cleanup failed:', error);
    }
  }
}

export default MigrationHelper;