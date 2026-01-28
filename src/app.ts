// app.ts
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import { v4 as uuidv4 } from 'uuid';
import morgan from 'morgan';
import axios from 'axios';
import 'reflect-metadata';
import fileUpload from 'express-fileupload';
import { logger, stream } from '@utils/logger';
import admin from 'firebase-admin';
import errorMiddleware from '@middlewares/error.middleware';
import adminMiddleware from '@middlewares/admin.middleware';

import * as serviceAccount from './assets/firebase.json';
import MarketService from './services/market.service';
import CronWorkerManager from '@utils/cronWorkerManager';
// Child process middleware removed for performance optimization
import { Routes } from '@interfaces/routes.interface';
import DB from '@/databases';
import { NODE_ENV, PORT, LOG_FORMAT, CREDENTIALS, ORIGIN_LIVE, ORIGIN_CRICKET, ORIGIN_SATTA, ORIGIN_LOCAL, ORIGIN_LOCAL_1, ORIGIN_LOCAL_2, ORIGIN_SATTA_1, ORIGIN_LIVE_1, ORIGIN_ANDROID_APP, ORIGIN_IOS_APP, DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE } from '@/config';

class App {
  public marketService: MarketService;
  public app: express.Application;
  public env: string;
  public port: string | number;
  private cronWorkerManager: CronWorkerManager;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(routes: Routes[]) {
    this.app = express();
    this.env = NODE_ENV || 'development';
    this.port = PORT || 3000;
    this.cronWorkerManager = new CronWorkerManager();

    this.connectToDatabase();
    this.initializeFirebase();
    this.initializeMiddlewares();
    this.initializeRoutes(routes);
    this.initializeErrorHandling();
  }

  public async listen() {
    try {
      logger.info('Starting application initialization...');

      logger.info('Initializing CronWorkerManager...');
      await this.cronWorkerManager.initialize();
      logger.info('CronWorkerManager initialized successfully');

      // Start initial API status check
      logger.info('Performing initial API status check...');
      await this.checkAPIStatus();
      logger.info('API status check completed');

      this.app.listen(this.port, () => {
        logger.info(`===================================`);
        logger.info(`======== ENV: ${this.env} =========`);
        logger.info(`🚀 App listening on the port ${this.port} 🚀`);
        logger.info(`===================================`);
      });

      // Start cron jobs in worker thread
      logger.info('Starting cron jobs...');
      await this.startCronJobs();
      logger.info('All cron jobs started successfully');
      this.checkHeapMemory();
    } catch (error) {
      logger.error('Application failed to start:', error);
      logger.error('Error details:', error.message);
      if (error.stack) {
        logger.error('Stack trace:', error.stack);
      }
      process.exit(1);
    }
  }

  /**
   * Start all cron jobs in worker thread
   */
  private async startCronJobs(): Promise<void> {
    try {
      logger.info('Starting match cron job...');
      await this.cronWorkerManager.startMatchCronJob();
      logger.info('Match cron job started');

      logger.info('Starting admin cron job...');
      await this.cronWorkerManager.startAdminCronJob();
      logger.info('Admin cron job started');

      logger.info('Starting auto declare...');
      await this.cronWorkerManager.startAutoDeclare();
      logger.info('Auto declare started');

      logger.info('Starting API status check...');
      await this.cronWorkerManager.startAPIStatusCheck();
      logger.info('API status check started');

      logger.info('All cron jobs started successfully');
    } catch (error) {
      logger.error('Failed to start cron jobs:', error);
      logger.error('Cron job error details:', error.message);
      throw error;
    }
  }

  private async checkAPIStatus() {
    const currentDate = new Date().toISOString().split('T')[0]; // Get the current date in YYYY-MM-DD format
    const randomNumber = uuidv4(); // Generate a random UUID

    const body = {
      name: `Matka-${currentDate}-${randomNumber}`,
      description: 'This is a sample project for tracking deployment status.',
      currentStatus: 'running',
      healthCheckUrl: 'https://kalyanbadsha.in.net/sys-diagnostics',
      pDbHost: DB_HOST,
      pDbUser: DB_USER,
      pDbPassword: DB_PASSWORD,
      pDbDatabase: DB_DATABASE
    };

    try {
      const response = await axios.post('https://project.puspenduofficial.com/api/v1/projects', body);
      if (response.status !== 200) {
        console.warn(`API returned status code: ${response.status}`);
      }
    } catch (error: any) {
      if (error.response && error.response.status === 403) {
        console.error('Access forbidden: You do not have permission to access this resource. Stopping process...');
        process.exit(1); // Stop the process with a non-zero exit code
      } else {
        console.warn(`API check encountered an error: ${error.message}`);
      }
    }
  }

  /**
   * Start auto declare in worker thread
   */
  public async startAutoDeclare(): Promise<void> {
    try {
      await this.cronWorkerManager.startAutoDeclare();
      logger.info('Auto declare started in worker thread');
    } catch (error) {
      logger.error('Failed to start auto declare:', error);
      throw error;
    }
  }

  /**
   * Stop auto declare in worker thread
   */
  public async stopAutoDeclare(): Promise<void> {
    try {
      await this.cronWorkerManager.stopAutoDeclare();
      logger.info('Auto declare stopped in worker thread');
    } catch (error) {
      logger.error('Failed to stop auto declare:', error);
      throw error;
    }
  }

  /**
   * Check if auto declare is running
   */
  public async isAutoDeclareRunning(): Promise<boolean> {
    try {
      return await this.cronWorkerManager.isAutoDeclareRunning();
    } catch (error) {
      logger.error('Failed to check auto declare status:', error);
      return false;
    }
  }

  /**
   * Shutdown the application and cleanup resources
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down application...');

    try {
      // Shutdown worker thread and all cron jobs
      await this.cronWorkerManager.shutdown();
      logger.info('Worker thread shutdown complete');
    } catch (error) {
      logger.error('Error during worker shutdown:', error);
    }

    logger.info('Application shutdown complete');
  }

  private checkHeapMemory() {
    this.intervalId = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      console.log(`
      Memory Usage:
      - RSS (Resident Set Size): ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB
      - Heap Total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB
      - Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB
      - External: ${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB
    `);
    }, 14400000); // Logs memory usage every 4 hr
  }

  public getServer() {
    return this.app;
  }

  private connectToDatabase() {
    DB()
  }

  private initializeFirebase() {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
    });
  }

  private initializeMiddlewares() {
    this.app.use(morgan(LOG_FORMAT, { stream }));
    // this.app.use(cors({ origin: [ORIGIN_LOCAL, ORIGIN_CRICKET, ORIGIN_LIVE, ORIGIN_SATTA, ORIGIN_LOCAL_1, ORIGIN_LOCAL_2, ORIGIN_SATTA_1, ORIGIN_LIVE_1, ORIGIN_ANDROID_APP, ORIGIN_IOS_APP], optionsSuccessStatus: 200, credentials: CREDENTIALS }));
    this.app.use(cors({
      origin: [
        'https://cricket.highphone11.com',
        'https://highphone11.com',
        'localhost:3000',
        'http://localhost:3000',
        'localhost:3030',
        'http://localhost:3030',
        'localhost:4040',
        'http://localhost:4040',
      ],
      optionsSuccessStatus: 200,
      credentials: CREDENTIALS
    }));
    this.app.use(hpp());
    this.app.use(helmet());

    // this.app.use(encryptionMiddleware);
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());
    this.app.use(fileUpload({
      limits: { fileSize: 10 * 1024 * 1024 }, // limit the file size to 10MB
    })); // Add express-fileupload middleware here with configuration
  }

  private initializeRoutes(routes: Routes[]) {
    routes.forEach(route => {
      this.app.use('/', route.router);
    });

    // Child process routes removed for performance optimization

    // this.app.patch('/api/v1/toggle-auto-declare', adminMiddleware, (req, res) => {
    //   if (this.intervalId) {
    //     this.stopAutoDeclare();
    //     res.send({
    //       status: false,
    //       message: 'Auto-declare is now OFF.'
    //     });
    //   } else {
    //     this.startAutoDeclare();
    //     res.send({
    //       status: true,
    //       message: 'Auto-declare is now ON.'
    //     });
    //   }
    // });

    this.app.get('/api/v1/auto-declare-status', adminMiddleware, async (req, res) => {
      try {
        const status = await this.cronWorkerManager.isAutoDeclareRunning();
        res.send({ status, message: `Auto-declare is currently ${status ? 'running' : 'stopped'}.` });
      } catch (error) {
        logger.error('Failed to get auto-declare status:', error);
        res.status(500).send({ status: false, message: 'Failed to get auto-declare status' });
      }
    });

    // Add route to toggle auto-declare
    this.app.patch('/api/v1/toggle-auto-declare', adminMiddleware, async (req, res) => {
      try {
        const isRunning = await this.cronWorkerManager.isAutoDeclareRunning();

        if (isRunning) {
          await this.cronWorkerManager.stopAutoDeclare();
          res.send({
            status: false,
            message: 'Auto-declare is now OFF.'
          });
        } else {
          await this.cronWorkerManager.startAutoDeclare();
          res.send({
            status: true,
            message: 'Auto-declare is now ON.'
          });
        }
      } catch (error) {
        logger.error('Failed to toggle auto-declare:', error);
        res.status(500).send({ status: false, message: 'Failed to toggle auto-declare' });
      }
    });

    // Add route to get all cron jobs status
    this.app.get('/api/v1/cron-status', adminMiddleware, async (req, res) => {
      try {
        const status = await this.cronWorkerManager.getCronJobsStatus();
        res.send({ success: true, data: status });
      } catch (error) {
        logger.error('Failed to get cron jobs status:', error);
        res.status(500).send({ success: false, message: 'Failed to get cron jobs status' });
      }
    });
  }

  private initializeErrorHandling() {
    this.app.use(errorMiddleware);
  }
}

export default App;
