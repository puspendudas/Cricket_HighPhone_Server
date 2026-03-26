// optimizedIndex.ts

import mongoose from 'mongoose';
import { logger } from '../utils/logger';

/**
 * Optimized MongoDB connection configuration for better performance and connection management
 * Addresses connection pooling issues and implements proper error handling
 */

// Connection state tracking
let isConnecting = false;
let connectionPromise: Promise<typeof mongoose> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds

// Performance monitoring
let connectionMetrics = {
  totalConnections: 0,
  failedConnections: 0,
  lastConnectionTime: 0,
  connectionDuration: 0
};

/**
 * Optimized MongoDB connection function with enhanced pooling and error handling
 */
const OptimizedDB = async (): Promise<typeof mongoose> => {
  try {
    // Return existing connection if already connected
    if (mongoose.connection.readyState === 1) {
      logger.debug('[OptimizedDB] Using existing database connection');
      return mongoose;
    }

    // Return existing connection promise if currently connecting
    if (isConnecting && connectionPromise) {
      logger.debug('[OptimizedDB] Connection in progress, waiting...');
      return await connectionPromise;
    }

    // Start new connection
    isConnecting = true;
    const startTime = Date.now();
    
    logger.info('[OptimizedDB] Establishing optimized database connection...');

    // Create connection promise
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }
    
    connectionPromise = mongoose.connect(mongoUri, {
      // Optimized connection pool settings
      maxPoolSize: 15,        // Increased from 10 for better concurrency
      minPoolSize: 2,         // Increased from 1 to maintain connections
      maxIdleTimeMS: 45000,   // Increased from 30000 for better reuse
      
      // Connection timeout settings
      serverSelectionTimeoutMS: 10000,  // Reduced from default 30000
      socketTimeoutMS: 20000,           // Reduced from default 0 (no timeout)
      connectTimeoutMS: 15000,          // Reduced from default 30000
      
      // Heartbeat and monitoring
      heartbeatFrequencyMS: 5000,       // More frequent heartbeats
      
      // Write concern and read preference
      writeConcern: {
        w: 'majority',
        j: true,
        wtimeout: 10000
      },
      readPreference: 'primaryPreferred',
      
      // Buffer settings
      // bufferMaxEntries option is deprecated, using bufferCommands instead
      bufferCommands: false,            // Disable command buffering
      
      // Additional optimizations
      autoIndex: false,                 // Disable auto-indexing in production
      autoCreate: false,                // Disable auto-collection creation
      
      // Compression
      compressors: ['zlib'],
      zlibCompressionLevel: 6,
      
      // Retry settings
      retryWrites: true,
      retryReads: true,
      
      // Application name for monitoring
      appName: 'Cricket-Backend-Optimized'
    });

    const connection = await connectionPromise;
    
    // Update metrics
    connectionMetrics.totalConnections++;
    connectionMetrics.lastConnectionTime = Date.now();
    connectionMetrics.connectionDuration = Date.now() - startTime;
    reconnectAttempts = 0;
    
    logger.info(`[OptimizedDB] Database connected successfully in ${connectionMetrics.connectionDuration}ms`);
    logger.info(`[OptimizedDB] Connection pool - Max: 15, Min: 2, Current: ${(mongoose.connection.db as any)?.serverConfig?.s?.poolSize || 'unknown'}`);
    
    return connection;

  } catch (error) {
    connectionMetrics.failedConnections++;
    logger.error('[OptimizedDB] Database connection failed:', error);
    
    // Handle reconnection logic
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      logger.warn(`[OptimizedDB] Attempting reconnection ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_DELAY}ms`);
      
      await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));
      return OptimizedDB(); // Recursive retry
    }
    
    throw new Error(`Failed to connect to database after ${MAX_RECONNECT_ATTEMPTS} attempts: ${error}`);
  } finally {
    isConnecting = false;
    connectionPromise = null;
  }
};

/**
 * Setup optimized connection event handlers
 */
const setupConnectionHandlers = (): void => {
  // Connection successful
  mongoose.connection.on('connected', () => {
    logger.info('[OptimizedDB] Mongoose connected to primary MongoDB');
    reconnectAttempts = 0;
  });

  // Connection error
  mongoose.connection.on('error', (error) => {
    logger.error('[OptimizedDB] Mongoose connection error:', error);
    connectionMetrics.failedConnections++;
  });

  // Connection disconnected
  mongoose.connection.on('disconnected', () => {
    logger.warn('[OptimizedDB] Mongoose disconnected from primary MongoDB');
    
    // Attempt automatic reconnection
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      setTimeout(() => {
        logger.info('[OptimizedDB] Attempting automatic reconnection...');
        OptimizedDB().catch(error => {
          logger.error('[OptimizedDB] Automatic reconnection failed:', error);
        });
      }, RECONNECT_DELAY);
    }
  });

  // Connection reconnected
  mongoose.connection.on('reconnected', () => {
    logger.info('[OptimizedDB] Mongoose reconnected to primary MongoDB');
    reconnectAttempts = 0;
  });

  // Connection close
  mongoose.connection.on('close', () => {
    logger.info('[OptimizedDB] Mongoose connection closed');
  });

  // SIGINT handler for graceful shutdown
  process.on('SIGINT', async () => {
    try {
      await mongoose.connection.close();
      logger.info('[OptimizedDB] Database connection closed due to application termination');
      process.exit(0);
    } catch (error) {
      logger.error('[OptimizedDB] Error during graceful shutdown:', error);
      process.exit(1);
    }
  });

  // SIGTERM handler for graceful shutdown
  process.on('SIGTERM', async () => {
    try {
      await mongoose.connection.close();
      logger.info('[OptimizedDB] Database connection closed due to SIGTERM');
      process.exit(0);
    } catch (error) {
      logger.error('[OptimizedDB] Error during SIGTERM shutdown:', error);
      process.exit(1);
    }
  });

  // Unhandled promise rejection
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('[OptimizedDB] Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Uncaught exception
  process.on('uncaughtException', (error) => {
    logger.error('[OptimizedDB] Uncaught Exception:', error);
    process.exit(1);
  });
};

/**
 * Get connection health status
 */
const getConnectionHealth = (): any => {
  const connection = mongoose.connection;
  const readyStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  
  return {
    state: readyStates[connection.readyState] || 'unknown',
    readyState: connection.readyState,
    host: connection.host,
    port: connection.port,
    name: connection.name,
    collections: Object.keys(connection.collections).length,
    metrics: connectionMetrics,
    poolSize: {
      current: (connection.db as any)?.serverConfig?.s?.poolSize || 0,
      max: 15,
      min: 2
    },
    serverInfo: {
      version: (connection.db as any)?.serverConfig?.s?.serverDescription?.version,
      type: (connection.db as any)?.serverConfig?.s?.serverDescription?.type
    }
  };
};

/**
 * Force close all connections (for testing or emergency)
 */
const forceCloseConnections = async (): Promise<void> => {
  try {
    logger.warn('[OptimizedDB] Force closing all database connections...');
    await mongoose.connection.close(true); // Force close
    logger.info('[OptimizedDB] All connections force closed');
  } catch (error) {
    logger.error('[OptimizedDB] Error force closing connections:', error);
    throw error;
  }
};

/**
 * Reset connection metrics
 */
const resetMetrics = (): void => {
  connectionMetrics = {
    totalConnections: 0,
    failedConnections: 0,
    lastConnectionTime: 0,
    connectionDuration: 0
  };
  reconnectAttempts = 0;
  logger.info('[OptimizedDB] Connection metrics reset');
};

/**
 * Check if database is ready for operations
 */
const isDatabaseReady = (): boolean => {
  return mongoose.connection.readyState === 1;
};

/**
 * Wait for database to be ready with timeout
 */
const waitForDatabase = async (timeoutMs = 30000): Promise<boolean> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (isDatabaseReady()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return false;
};

/**
 * Get detailed connection statistics
 */
const getConnectionStats = (): any => {
  return {
    ...getConnectionHealth(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    activeHandles: (process as any)._getActiveHandles?.()?.length ?? 0,
    activeRequests: (process as any)._getActiveRequests?.()?.length ?? 0,
    eventLoopDelay: process.hrtime(),
    connectionAge: connectionMetrics.lastConnectionTime > 0 
      ? Date.now() - connectionMetrics.lastConnectionTime 
      : 0
  };
};

// Setup connection handlers
setupConnectionHandlers();

// Export optimized database functions
export {
  OptimizedDB as default,
  getConnectionHealth,
  forceCloseConnections,
  resetMetrics,
  isDatabaseReady,
  waitForDatabase,
  getConnectionStats
};

// Log initialization
logger.info('[OptimizedDB] Optimized database module initialized');