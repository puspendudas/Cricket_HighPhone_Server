import { Router, Request, Response } from 'express';
import { Routes } from '@interfaces/routes.interface';
import { logger } from '@utils/logger';
import MonitoringService from '@services/monitoring.service';
import MigrationHelper from '@utils/migrationHelper';
import { getConnectionHealth, getConnectionStats } from '@/databases/optimizedIndex';

/**
 * Monitoring routes for real-time system health, performance metrics, and cron job management
 * Provides comprehensive endpoints for monitoring the optimized cron worker system
 */
class MonitoringRoute implements Routes {
  public path = '/monitoring';
  public router = Router();
  private monitoringService = MonitoringService.getInstance();
  private migrationHelper = MigrationHelper.getInstance();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/health`, this.getHealth.bind(this));
    this.router.get(`${this.path}/performance`, this.getPerformance.bind(this));
    this.router.get(`${this.path}/cron-status`, this.getCronStatus.bind(this));
    this.router.get(`${this.path}/database`, this.getDatabase.bind(this));
    this.router.get(`${this.path}/alerts`, this.getAlerts.bind(this));
    this.router.post(`${this.path}/reset-metrics`, this.resetMetrics.bind(this));
    this.router.post(`${this.path}/update-thresholds`, this.updateThresholds.bind(this));
    this.router.get(`${this.path}/migration-status`, this.getMigrationStatus.bind(this));
    this.router.post(`${this.path}/force-gc`, this.forceGC.bind(this));
    this.router.get(`${this.path}/system-info`, this.getSystemInfo.bind(this));
  }

  /**
   * @route GET /api/monitoring/health
   * @desc Get comprehensive system health report
   * @access Public (should be protected in production)
   */
  private async getHealth(req: Request, res: Response) {
    try {
      const healthReport = this.monitoringService.getHealthReport();
      const connectionHealth = getConnectionHealth();
    
    const response = {
      status: 'success',
      timestamp: new Date().toISOString(),
      health: {
        overall: this.determineOverallHealth(healthReport),
        ...healthReport,
        database: {
          ...healthReport.database,
          connection: connectionHealth
        }
      }
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    logger.error('[MonitoringRoutes] Error getting health report:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get health report',
      error: error.message
    });
  }
}

  /**
   * @route GET /api/monitoring/performance
   * @desc Get detailed performance statistics
   * @access Public (should be protected in production)
   */
  private async getPerformance(req: Request, res: Response) {
    try {
      const healthReport = this.monitoringService.getHealthReport();
      const connectionStats = getConnectionStats();
    
    const performanceData = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: {
          current: process.memoryUsage(),
          peak: healthReport.system.memoryPeakMB,
          usage_trend: this.calculateMemoryTrend()
        },
        cpu: {
          usage: process.cpuUsage(),
          load_average: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0]
        }
      },
      database: {
        ...connectionStats,
        performance: {
          averageResponseTime: healthReport.database.averageResponseTime,
          totalQueries: healthReport.database.totalQueries,
          failedQueries: healthReport.database.failedQueries,
          querySuccessRate: healthReport.database.totalQueries > 0 
            ? ((healthReport.database.totalQueries - healthReport.database.failedQueries) / healthReport.database.totalQueries * 100).toFixed(2) + '%'
            : '100%'
        }
      },
      cronJobs: {
        ...healthReport.cronJobs,
        performance: {
          successRate: (100 - (healthReport.cronJobs.errorRate * 100)).toFixed(2) + '%',
          averageExecutionTime: healthReport.cronJobs.averageExecutionTime,
          longestExecutionTime: healthReport.cronJobs.longestExecutionTime
        }
      },
      alerts: healthReport.alerts
    };
    
    res.status(200).json({
       status: 'success',
       data: performanceData
     });
     
   } catch (error) {
     logger.error('[MonitoringRoutes] Error getting performance data:', error);
     res.status(500).json({
       status: 'error',
       message: 'Failed to get performance data',
       error: error.message
     });
   }
 }

  /**
   * @route GET /api/monitoring/cron-status
   * @desc Get current cron job status and metrics
   * @access Public (should be protected in production)
   */
  private async getCronStatus(req: Request, res: Response) {
  try {
    // This would need to be adapted based on your current cron worker manager
    // For now, we'll return monitoring service data
      const healthReport = this.monitoringService.getHealthReport();
    
    const cronStatus = {
      timestamp: new Date().toISOString(),
      jobs: healthReport.cronJobs,
      performance: {
        totalExecutions: healthReport.cronJobs.totalExecutions,
        totalErrors: healthReport.cronJobs.totalErrors,
        errorRate: (healthReport.cronJobs.errorRate * 100).toFixed(2) + '%',
        averageExecutionTime: healthReport.cronJobs.averageExecutionTime + 'ms',
        longestExecutionTime: healthReport.cronJobs.longestExecutionTime + 'ms',
        lastExecution: new Date(healthReport.cronJobs.lastExecution).toISOString()
      },
      recommendations: healthReport.recommendations.filter(r => 
        r.toLowerCase().includes('cron') || r.toLowerCase().includes('job')
      )
    };
    
    res.status(200).json({
       status: 'success',
       data: cronStatus
     });
     
   } catch (error) {
     logger.error('[MonitoringRoutes] Error getting cron status:', error);
     res.status(500).json({
       status: 'error',
       message: 'Failed to get cron status',
       error: error.message
     });
   }
 }

  /**
   * @route GET /api/monitoring/database
   * @desc Get detailed database connection and performance metrics
   * @access Public (should be protected in production)
   */
  private async getDatabase(req: Request, res: Response) {
  try {
    const connectionHealth = getConnectionHealth();
    const connectionStats = getConnectionStats();
      const healthReport = this.monitoringService.getHealthReport();
    
    const databaseMetrics = {
      timestamp: new Date().toISOString(),
      connection: {
        ...connectionHealth,
        uptime: connectionStats.uptime,
        connectionAge: connectionStats.connectionAge
      },
      performance: {
        averageResponseTime: healthReport.database.averageResponseTime,
        totalQueries: healthReport.database.totalQueries,
        failedQueries: healthReport.database.failedQueries,
        successRate: healthReport.database.totalQueries > 0 
          ? ((healthReport.database.totalQueries - healthReport.database.failedQueries) / healthReport.database.totalQueries * 100).toFixed(2) + '%'
          : '100%'
      },
      pooling: {
        current: connectionHealth.poolSize.current,
        max: connectionHealth.poolSize.max,
        min: connectionHealth.poolSize.min,
        utilization: ((connectionHealth.poolSize.current / connectionHealth.poolSize.max) * 100).toFixed(2) + '%'
      },
      alerts: healthReport.alerts.recent.filter(alert => 
        alert.type.toLowerCase().includes('database') || 
        alert.type.toLowerCase().includes('connection')
      )
    };
    
    res.status(200).json({
       status: 'success',
       data: databaseMetrics
     });
     
   } catch (error) {
     logger.error('[MonitoringRoutes] Error getting database metrics:', error);
     res.status(500).json({
       status: 'error',
       message: 'Failed to get database metrics',
       error: error.message
     });
   }
 }

  /**
   * @route GET /api/monitoring/alerts
   * @desc Get current alerts and their details
   * @access Public (should be protected in production)
   */
  private async getAlerts(req: Request, res: Response) {
  try {
    const { severity, limit = 50 } = req.query;
      const healthReport = this.monitoringService.getHealthReport();
    
    let alerts = healthReport.alerts.recent;
    
    // Filter by severity if specified
    if (severity && typeof severity === 'string') {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    // Limit results
    alerts = alerts.slice(0, parseInt(limit as string));
    
    const alertSummary = {
      timestamp: new Date().toISOString(),
      summary: {
        total: healthReport.alerts.total,
        critical: healthReport.alerts.critical,
        high: healthReport.alerts.high,
        byType: this.groupAlertsByType(healthReport.alerts.recent)
      },
      alerts: alerts.map(alert => ({
        ...alert,
        timestamp: new Date(alert.timestamp).toISOString(),
        age: Date.now() - alert.timestamp
      })),
      recommendations: healthReport.recommendations
    };
    
    res.status(200).json({
       status: 'success',
       data: alertSummary
     });
     
   } catch (error) {
     logger.error('[MonitoringRoutes] Error getting alerts:', error);
     res.status(500).json({
       status: 'error',
       message: 'Failed to get alerts',
       error: error.message
     });
   }
 }

  /**
   * @route POST /api/monitoring/reset-metrics
   * @desc Reset monitoring metrics
   * @access Public (should be protected in production)
   */
  private async resetMetrics(req: Request, res: Response) {
  try {
      this.monitoringService.resetMetrics();
    
    res.status(200).json({
       status: 'success',
       message: 'Monitoring metrics reset successfully',
       timestamp: new Date().toISOString()
     });
     
   } catch (error) {
     logger.error('[MonitoringRoutes] Error resetting metrics:', error);
     res.status(500).json({
       status: 'error',
       message: 'Failed to reset metrics',
       error: error.message
     });
   }
 }

  /**
   * @route POST /api/monitoring/update-thresholds
   * @desc Update alert thresholds
   * @access Public (should be protected in production)
   */
  private async updateThresholds(req: Request, res: Response) {
  try {
    const { thresholds } = req.body;
    
    if (!thresholds || typeof thresholds !== 'object') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid thresholds provided'
      });
    }
    
      this.monitoringService.updateThresholds(thresholds);
    
    res.status(200).json({
       status: 'success',
       message: 'Alert thresholds updated successfully',
       updatedThresholds: thresholds,
       timestamp: new Date().toISOString()
     });
     
   } catch (error) {
     logger.error('[MonitoringRoutes] Error updating thresholds:', error);
     res.status(500).json({
       status: 'error',
       message: 'Failed to update thresholds',
       error: error.message
     });
   }
 }

  /**
   * @route GET /api/monitoring/migration-status
   * @desc Get migration status and progress
   * @access Public (should be protected in production)
   */
  private async getMigrationStatus(req: Request, res: Response) {
  try {
      const migrationStatus = this.migrationHelper.getMigrationStatus();
    
    res.status(200).json({
       status: 'success',
       data: {
         ...migrationStatus,
         timestamp: new Date().toISOString()
       }
     });
     
   } catch (error) {
     logger.error('[MonitoringRoutes] Error getting migration status:', error);
     res.status(500).json({
       status: 'error',
       message: 'Failed to get migration status',
       error: error.message
     });
   }
 }

  /**
   * @route POST /api/monitoring/force-gc
   * @desc Force garbage collection (if available)
   * @access Public (should be protected in production)
   */
  private async forceGC(req: Request, res: Response) {
  try {
    const beforeGC = process.memoryUsage();
    
    if (global.gc) {
      global.gc();
      const afterGC = process.memoryUsage();
      
      res.status(200).json({
        status: 'success',
        message: 'Garbage collection forced successfully',
        memoryBefore: {
          heapUsed: Math.round(beforeGC.heapUsed / 1024 / 1024) + 'MB',
          rss: Math.round(beforeGC.rss / 1024 / 1024) + 'MB'
        },
        memoryAfter: {
          heapUsed: Math.round(afterGC.heapUsed / 1024 / 1024) + 'MB',
          rss: Math.round(afterGC.rss / 1024 / 1024) + 'MB'
        },
        memoryFreed: {
          heap: Math.round((beforeGC.heapUsed - afterGC.heapUsed) / 1024 / 1024) + 'MB',
          rss: Math.round((beforeGC.rss - afterGC.rss) / 1024 / 1024) + 'MB'
        },
        timestamp: new Date().toISOString()
      });
    } else {
       res.status(400).json({
         status: 'error',
         message: 'Garbage collection not available. Start Node.js with --expose-gc flag.'
       });
     }
     
   } catch (error) {
     logger.error('[MonitoringRoutes] Error forcing garbage collection:', error);
     res.status(500).json({
       status: 'error',
       message: 'Failed to force garbage collection',
       error: error.message
     });
   }
 }

  /**
   * @route GET /api/monitoring/system-info
   * @desc Get detailed system information
   * @access Public (should be protected in production)
   */
  private async getSystemInfo(req: Request, res: Response) {
  try {
    const os = require('os');
    
    const systemInfo = {
      timestamp: new Date().toISOString(),
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime()
      },
      system: {
        hostname: os.hostname(),
        type: os.type(),
        release: os.release(),
        totalMemory: Math.round(os.totalmem() / 1024 / 1024) + 'MB',
        freeMemory: Math.round(os.freemem() / 1024 / 1024) + 'MB',
        cpus: os.cpus().length,
        loadAverage: process.platform !== 'win32' ? os.loadavg() : [0, 0, 0]
      },
      process: {
        pid: process.pid,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        activeHandles: (process as any)._getActiveHandles?.()?.length ?? 0,
        activeRequests: (process as any)._getActiveRequests?.()?.length ?? 0
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };
    
    res.status(200).json({
       status: 'success',
       data: systemInfo
     });
     
   } catch (error) {
     logger.error('[MonitoringRoutes] Error getting system info:', error);
     res.status(500).json({
       status: 'error',
       message: 'Failed to get system info',
       error: error.message
     });
   }
 }

  /**
   * Helper function to determine overall health status
   */
  private determineOverallHealth(healthReport: any): string {
  if (healthReport.alerts.critical > 0) {
    return 'critical';
  }
  
  if (healthReport.alerts.high > 3) {
    return 'warning';
  }
  
  if (healthReport.database.connectionState !== 'connected') {
    return 'unhealthy';
  }
  
  if (healthReport.system.currentMemoryMB > 400) {
    return 'warning';
  }
  
  return 'healthy';
 }

 /**
  * Helper function to calculate memory trend
  */
 private calculateMemoryTrend(): string {
  // This would require historical data - simplified for now
  const currentMemory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  
  if (currentMemory > 300) {
    return 'increasing';
  } else if (currentMemory < 100) {
    return 'decreasing';
  } else {
     return 'stable';
   }
 }

 /**
  * Helper function to group alerts by type
  */
 private groupAlertsByType(alerts: any[]): any {
  const grouped: any = {};
  
  alerts.forEach(alert => {
    if (!grouped[alert.type]) {
      grouped[alert.type] = 0;
    }
    grouped[alert.type]++;
  });
  
  return grouped;
 }
}

export default MonitoringRoute;