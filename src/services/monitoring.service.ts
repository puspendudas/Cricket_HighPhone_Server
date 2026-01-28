// monitoring.service.ts

import { logger } from '../utils/logger';
import mongoose from 'mongoose';
import { performance } from 'perf_hooks';
import { getConnectionHealth, getConnectionStats } from '../databases/optimizedIndex';

/**
 * MonitoringService provides comprehensive monitoring for database connections,
 * cron job performance, and system health to prevent performance issues
 */
class MonitoringService {
  private static instance: MonitoringService;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertThresholds = {
    memoryUsageMB: 400,
    connectionPoolUtilization: 0.8,
    cronJobExecutionTimeMs: 15000,
    errorRate: 0.1,
    databaseResponseTimeMs: 5000
  };
  
  private metrics = {
    systemHealth: {
      startTime: Date.now(),
      totalRequests: 0,
      totalErrors: 0,
      memoryPeakMB: 0,
      cpuUsage: 0
    },
    databaseHealth: {
      connectionCount: 0,
      poolUtilization: 0,
      averageResponseTime: 0,
      totalQueries: 0,
      failedQueries: 0,
      lastHealthCheck: 0
    },
    cronJobHealth: {
      totalExecutions: 0,
      totalErrors: 0,
      averageExecutionTime: 0,
      longestExecutionTime: 0,
      lastExecution: 0,
      activeJobs: 0
    },
    alerts: [] as Array<{
      type: string;
      message: string;
      timestamp: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>
  };

  private constructor() {
    this.startMonitoring();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Start comprehensive monitoring
   */
  private startMonitoring(): void {
    logger.info('[MonitoringService] Starting comprehensive monitoring...');
    
    // Monitor every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
    }, 30000);

    // Initial health check
    setTimeout(() => {
      this.performHealthChecks();
    }, 5000);
  }

  /**
   * Perform comprehensive health checks
   */
  private async performHealthChecks(): Promise<void> {
    try {
      await Promise.all([
        this.checkSystemHealth(),
        this.checkDatabaseHealth(),
        this.checkMemoryUsage(),
        this.cleanOldAlerts()
      ]);
    } catch (error) {
      logger.error('[MonitoringService] Error during health checks:', error);
    }
  }

  /**
   * Check system health metrics
   */
  private async checkSystemHealth(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      
      // Update metrics
      this.metrics.systemHealth.memoryPeakMB = Math.max(
        this.metrics.systemHealth.memoryPeakMB,
        heapUsedMB
      );

      // Check memory threshold
      if (heapUsedMB > this.alertThresholds.memoryUsageMB) {
        this.addAlert({
          type: 'MEMORY_HIGH',
          message: `High memory usage detected: ${heapUsedMB}MB (threshold: ${this.alertThresholds.memoryUsageMB}MB)`,
          timestamp: Date.now(),
          severity: heapUsedMB > this.alertThresholds.memoryUsageMB * 1.2 ? 'critical' : 'high'
        });
      }

      // Check uptime and log periodic stats
      const uptimeHours = Math.floor(process.uptime() / 3600);
      if (uptimeHours > 0 && process.uptime() % 3600 < 30) {
        logger.info(`[MonitoringService] System uptime: ${uptimeHours}h, Memory: ${heapUsedMB}MB, Peak: ${this.metrics.systemHealth.memoryPeakMB}MB`);
      }

    } catch (error) {
      logger.error('[MonitoringService] Error checking system health:', error);
    }
  }

  /**
   * Check database health and connection pool status
   */
  private async checkDatabaseHealth(): Promise<void> {
    try {
      const startTime = performance.now();
      const connectionHealth = getConnectionHealth();
      const responseTime = performance.now() - startTime;
      
      // Update database metrics
      this.metrics.databaseHealth.lastHealthCheck = Date.now();
      this.metrics.databaseHealth.averageResponseTime = 
        (this.metrics.databaseHealth.averageResponseTime + responseTime) / 2;
      
      // Check database connection state
      if (mongoose.connection.readyState !== 1) {
        this.addAlert({
          type: 'DATABASE_DISCONNECTED',
          message: `Database connection unhealthy: ${connectionHealth.state}`,
          timestamp: Date.now(),
          severity: 'critical'
        });
      }

      // Check connection pool utilization
      const poolUtilization = connectionHealth.poolSize.current / connectionHealth.poolSize.max;
      this.metrics.databaseHealth.poolUtilization = poolUtilization;
      
      if (poolUtilization > this.alertThresholds.connectionPoolUtilization) {
        this.addAlert({
          type: 'CONNECTION_POOL_HIGH',
          message: `High connection pool utilization: ${Math.round(poolUtilization * 100)}% (${connectionHealth.poolSize.current}/${connectionHealth.poolSize.max})`,
          timestamp: Date.now(),
          severity: poolUtilization > 0.9 ? 'critical' : 'high'
        });
      }

      // Check database response time
      if (responseTime > this.alertThresholds.databaseResponseTimeMs) {
        this.addAlert({
          type: 'DATABASE_SLOW_RESPONSE',
          message: `Slow database response: ${Math.round(responseTime)}ms (threshold: ${this.alertThresholds.databaseResponseTimeMs}ms)`,
          timestamp: Date.now(),
          severity: responseTime > this.alertThresholds.databaseResponseTimeMs * 2 ? 'critical' : 'high'
        });
      }

    } catch (error) {
      logger.error('[MonitoringService] Error checking database health:', error);
      
      this.addAlert({
        type: 'DATABASE_HEALTH_CHECK_FAILED',
        message: `Database health check failed: ${error.message}`,
        timestamp: Date.now(),
        severity: 'critical'
      });
    }
  }

  /**
   * Check memory usage and trigger garbage collection if needed
   */
  private checkMemoryUsage(): void {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      // Force garbage collection if memory is very high and gc is available
      if (heapUsedMB > this.alertThresholds.memoryUsageMB * 1.5 && global.gc) {
        logger.warn(`[MonitoringService] Forcing garbage collection due to high memory usage: ${heapUsedMB}MB`);
        global.gc();
        
        // Check memory after GC
        const afterGC = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        logger.info(`[MonitoringService] Memory after GC: ${afterGC}MB (freed: ${heapUsedMB - afterGC}MB)`);
      }
    } catch (error) {
      logger.error('[MonitoringService] Error checking memory usage:', error);
    }
  }

  /**
   * Track cron job execution
   */
  public trackCronJobExecution(jobName: string, executionTime: number, success: boolean): void {
    try {
      this.metrics.cronJobHealth.totalExecutions++;
      this.metrics.cronJobHealth.lastExecution = Date.now();
      
      if (!success) {
        this.metrics.cronJobHealth.totalErrors++;
      }
      
      // Update average execution time
      this.metrics.cronJobHealth.averageExecutionTime = 
        (this.metrics.cronJobHealth.averageExecutionTime + executionTime) / 2;
      
      // Update longest execution time
      if (executionTime > this.metrics.cronJobHealth.longestExecutionTime) {
        this.metrics.cronJobHealth.longestExecutionTime = executionTime;
      }
      
      // Check for slow execution
      if (executionTime > this.alertThresholds.cronJobExecutionTimeMs) {
        this.addAlert({
          type: 'CRON_JOB_SLOW',
          message: `Slow cron job execution (${jobName}): ${Math.round(executionTime)}ms`,
          timestamp: Date.now(),
          severity: executionTime > this.alertThresholds.cronJobExecutionTimeMs * 2 ? 'critical' : 'high'
        });
      }
      
      // Check error rate
      const errorRate = this.metrics.cronJobHealth.totalErrors / this.metrics.cronJobHealth.totalExecutions;
      if (errorRate > this.alertThresholds.errorRate) {
        this.addAlert({
          type: 'CRON_JOB_HIGH_ERROR_RATE',
          message: `High cron job error rate: ${Math.round(errorRate * 100)}% (${this.metrics.cronJobHealth.totalErrors}/${this.metrics.cronJobHealth.totalExecutions})`,
          timestamp: Date.now(),
          severity: errorRate > 0.2 ? 'critical' : 'high'
        });
      }
      
    } catch (error) {
      logger.error('[MonitoringService] Error tracking cron job execution:', error);
    }
  }

  /**
   * Track database query execution
   */
  public trackDatabaseQuery(queryTime: number, success: boolean): void {
    try {
      this.metrics.databaseHealth.totalQueries++;
      
      if (!success) {
        this.metrics.databaseHealth.failedQueries++;
      }
      
      // Update average response time
      this.metrics.databaseHealth.averageResponseTime = 
        (this.metrics.databaseHealth.averageResponseTime + queryTime) / 2;
      
    } catch (error) {
      logger.error('[MonitoringService] Error tracking database query:', error);
    }
  }

  /**
   * Add alert to the system
   */
  private addAlert(alert: {
    type: string;
    message: string;
    timestamp: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): void {
    try {
      // Check if similar alert exists in the last 5 minutes to avoid spam
      const recentSimilarAlert = this.metrics.alerts.find(a => 
        a.type === alert.type && 
        Date.now() - a.timestamp < 300000 // 5 minutes
      );
      
      if (!recentSimilarAlert) {
        this.metrics.alerts.push(alert);
        
        // Log based on severity
        switch (alert.severity) {
          case 'critical':
            logger.error(`[MonitoringService] CRITICAL ALERT: ${alert.message}`);
            break;
          case 'high':
            logger.warn(`[MonitoringService] HIGH ALERT: ${alert.message}`);
            break;
          case 'medium':
            logger.warn(`[MonitoringService] MEDIUM ALERT: ${alert.message}`);
            break;
          case 'low':
            logger.info(`[MonitoringService] LOW ALERT: ${alert.message}`);
            break;
        }
      }
    } catch (error) {
      logger.error('[MonitoringService] Error adding alert:', error);
    }
  }

  /**
   * Clean old alerts (older than 1 hour)
   */
  private cleanOldAlerts(): void {
    try {
      const oneHourAgo = Date.now() - 3600000;
      this.metrics.alerts = this.metrics.alerts.filter(alert => alert.timestamp > oneHourAgo);
    } catch (error) {
      logger.error('[MonitoringService] Error cleaning old alerts:', error);
    }
  }

  /**
   * Get comprehensive health report
   */
  public getHealthReport(): any {
    try {
      const connectionStats = getConnectionStats();
      const memUsage = process.memoryUsage();
      
      return {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        system: {
          ...this.metrics.systemHealth,
          currentMemoryMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          rssMemoryMB: Math.round(memUsage.rss / 1024 / 1024),
          nodeVersion: process.version,
          platform: process.platform
        },
        database: {
          ...this.metrics.databaseHealth,
          connectionState: connectionStats.state,
          poolSize: connectionStats.poolSize,
          collections: connectionStats.collections
        },
        cronJobs: {
          ...this.metrics.cronJobHealth,
          errorRate: this.metrics.cronJobHealth.totalExecutions > 0 
            ? this.metrics.cronJobHealth.totalErrors / this.metrics.cronJobHealth.totalExecutions 
            : 0
        },
        alerts: {
          total: this.metrics.alerts.length,
          critical: this.metrics.alerts.filter(a => a.severity === 'critical').length,
          high: this.metrics.alerts.filter(a => a.severity === 'high').length,
          recent: this.metrics.alerts.slice(-10) // Last 10 alerts
        },
        recommendations: this.generateRecommendations()
      };
    } catch (error) {
      logger.error('[MonitoringService] Error generating health report:', error);
      return { error: 'Failed to generate health report' };
    }
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    try {
      // Memory recommendations
      const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      if (memUsage > this.alertThresholds.memoryUsageMB) {
        recommendations.push('Consider optimizing memory usage or increasing available memory');
      }
      
      // Database recommendations
      if (this.metrics.databaseHealth.poolUtilization > 0.8) {
        recommendations.push('Consider increasing database connection pool size');
      }
      
      if (this.metrics.databaseHealth.averageResponseTime > 1000) {
        recommendations.push('Database queries are slow - consider adding indexes or optimizing queries');
      }
      
      // Cron job recommendations
      if (this.metrics.cronJobHealth.averageExecutionTime > 10000) {
        recommendations.push('Cron jobs are taking too long - consider optimizing or breaking into smaller tasks');
      }
      
      const errorRate = this.metrics.cronJobHealth.totalExecutions > 0 
        ? this.metrics.cronJobHealth.totalErrors / this.metrics.cronJobHealth.totalExecutions 
        : 0;
      
      if (errorRate > 0.05) {
        recommendations.push('High cron job error rate detected - review error logs and improve error handling');
      }
      
      // Alert-based recommendations
      const criticalAlerts = this.metrics.alerts.filter(a => a.severity === 'critical').length;
      if (criticalAlerts > 0) {
        recommendations.push('Critical alerts detected - immediate attention required');
      }
      
    } catch (error) {
      logger.error('[MonitoringService] Error generating recommendations:', error);
    }
    
    return recommendations;
  }

  /**
   * Reset all metrics
   */
  public resetMetrics(): void {
    try {
      this.metrics = {
        systemHealth: {
          startTime: Date.now(),
          totalRequests: 0,
          totalErrors: 0,
          memoryPeakMB: 0,
          cpuUsage: 0
        },
        databaseHealth: {
          connectionCount: 0,
          poolUtilization: 0,
          averageResponseTime: 0,
          totalQueries: 0,
          failedQueries: 0,
          lastHealthCheck: 0
        },
        cronJobHealth: {
          totalExecutions: 0,
          totalErrors: 0,
          averageExecutionTime: 0,
          longestExecutionTime: 0,
          lastExecution: 0,
          activeJobs: 0
        },
        alerts: []
      };
      
      logger.info('[MonitoringService] Metrics reset successfully');
    } catch (error) {
      logger.error('[MonitoringService] Error resetting metrics:', error);
    }
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    try {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
      logger.info('[MonitoringService] Monitoring stopped');
    } catch (error) {
      logger.error('[MonitoringService] Error stopping monitoring:', error);
    }
  }

  /**
   * Update alert thresholds
   */
  public updateThresholds(newThresholds: Partial<typeof this.alertThresholds>): void {
    try {
      this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
      logger.info('[MonitoringService] Alert thresholds updated:', newThresholds);
    } catch (error) {
      logger.error('[MonitoringService] Error updating thresholds:', error);
    }
  }
}

export default MonitoringService;