// app.ts
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import 'reflect-metadata';
import fileUpload from 'express-fileupload';
import { logger, stream } from '@utils/logger';
import errorMiddleware from '@middlewares/error.middleware';

import MarketService from './services/market.service';
import CronWorkerManager from '@utils/cronWorkerManager';
import AutoDeclareWorkerManager from '@utils/autoDeclareWorkerManager';
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
  private autoDeclareWorkerManager: AutoDeclareWorkerManager;
  private intervalId?: NodeJS.Timeout;

  constructor(routes: Routes[]) {
    this.app = express();
    this.env = NODE_ENV || 'development';
    this.port = PORT || 3000;
    this.cronWorkerManager = new CronWorkerManager();
    this.autoDeclareWorkerManager = new AutoDeclareWorkerManager();

    this.connectToDatabase();
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

      logger.info('Initializing AutoDeclareWorkerManager...');
      await this.autoDeclareWorkerManager.initialize();
      logger.info('AutoDeclareWorkerManager initialized successfully');

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
    }
  }

  /**
   * Start all cron jobs in worker thread
   */
  private async startCronJobs(): Promise<void> {
    try {
      logger.info('Starting match cron job...');
      await this.cronWorkerManager.startMatchCronJob();
      logger.info('Match cron job started successfully');

      logger.info('Starting auto declare cron job...');
      await this.autoDeclareWorkerManager.startAutoDeclareCronJob();
      logger.info('Auto declare cron job started successfully');
    } catch (error) {
      logger.error('Failed to start cron jobs:', error);
      logger.error('Cron job error details:', error.message);
      throw error;
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
      await this.autoDeclareWorkerManager.shutdown();
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

  private initializeMiddlewares() {
    this.app.use(morgan(LOG_FORMAT, { stream }));
    // this.app.use(cors({ origin: [ORIGIN_LOCAL, ORIGIN_CRICKET, ORIGIN_LIVE, ORIGIN_SATTA, ORIGIN_LOCAL_1, ORIGIN_LOCAL_2, ORIGIN_SATTA_1, ORIGIN_LIVE_1, ORIGIN_ANDROID_APP, ORIGIN_IOS_APP], optionsSuccessStatus: 200, credentials: CREDENTIALS }));
    this.app.use(cors({
      origin: [
        'https://testingexch.com',
        'https://cricket.testingexch.com',
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
  }

  private initializeErrorHandling() {
    this.app.use(errorMiddleware);
  }
}

export default App;
