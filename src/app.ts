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
import http from 'http';

import MarketService from './services/market.service';
import { autoDeclareWorkerManager } from '@utils/autoDeclareWorkerManager';
import { Routes } from '@interfaces/routes.interface';
import DB from '@/databases';
import { NODE_ENV, PORT, LOG_FORMAT, CREDENTIALS, ORIGIN_LIVE, ORIGIN_CRICKET, ORIGIN_SATTA, ORIGIN_LOCAL, ORIGIN_LOCAL_1, ORIGIN_LOCAL_2, ORIGIN_SATTA_1, ORIGIN_LIVE_1, ORIGIN_ANDROID_APP, ORIGIN_IOS_APP, DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE } from '@/config';
import { terminalSocketClient } from '@/services/terminalSocketClient';
import { socketService } from '@/services/socket.service';
import { matchCache } from '@/services/matchCache.service';
import { quitRedis } from '@/services/redis.client';

class App {
  public marketService: MarketService;
  public app: express.Application;
  public env: string;
  public port: number;
  private autoDeclareWorkerManager = autoDeclareWorkerManager;
  private intervalId?: NodeJS.Timeout;
  private httpServer?: http.Server;

  constructor(routes: Routes[]) {
    this.app = express();
    this.env = NODE_ENV || 'development';
    const parsed = Number(PORT);
    this.port = Number.isFinite(parsed) && parsed > 0 ? parsed : 8778;

    this.connectToDatabase();
    this.initializeMiddlewares();
    this.initializeRoutes(routes);
    this.initializeErrorHandling();
  }

  public async listen() {
    try {
      logger.info('Starting application initialization...');

      logger.info('Initializing AutoDeclareWorkerManager...');
      await this.autoDeclareWorkerManager.initialize();
      logger.info('AutoDeclareWorkerManager initialized successfully');

      this.httpServer = http.createServer(this.app);
      await socketService.init(this.httpServer);

      // Listen before match cache bootstrap so Postman/clients can connect to TCP as soon as Socket.IO + Redis adapter are ready.
      // If bootstrap ran before listen(), any Redis/Mongo failure during bootstrap would leave no listener → "connection refused" on :8778.
      // Bind 0.0.0.0 so Docker (and Postman on the host) can reach the server; PORT must match compose publish (e.g. 8778:2552 → PORT=2552).
      this.httpServer.listen(this.port, '0.0.0.0', () => {
        logger.info(`===========================================`);
        logger.info(`============= ENV: ${this.env} ============`);
        logger.info(`🚀 App listening on the port ${this.port} 🚀`);
        logger.info(`===========================================`);
      });

      try {
        await matchCache.bootstrap();
      } catch (bootstrapErr: any) {
        logger.error('matchCache.bootstrap failed (server is still listening):', bootstrapErr?.message || bootstrapErr);
      }

      logger.info('Starting auto declare cron job...');
      await this.autoDeclareWorkerManager.startAutoDeclareCronJob();
      logger.info('Auto declare cron job started successfully');

      logger.info('Initializing Terminal WebSocket connection...');
      await terminalSocketClient.connect();
      logger.info('Terminal WebSocket initialized');

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
   * Shutdown the application and cleanup resources
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down application...');

    try {
      await this.autoDeclareWorkerManager.shutdown();
      await terminalSocketClient.disconnect();
      await socketService.shutdown();
      await quitRedis();
      if (this.httpServer) {
        this.httpServer.close();
      }
      logger.info('Shutdown complete');
    } catch (error) {
      logger.error('Error during shutdown:', error);
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
        'https://highphone11.com',
        'https://cricket.highphone11.com',
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
