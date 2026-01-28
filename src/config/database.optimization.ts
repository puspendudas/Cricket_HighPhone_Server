// database.optimization.ts

import mongoose from 'mongoose';
import { logger } from '@/utils/logger';

/**
 * Database optimization configuration for better performance
 */
export class DatabaseOptimization {
    /**
     * Configure MongoDB connection for optimal performance
     */
    public static configureConnection(): void {
        // Query optimization
        mongoose.set('bufferCommands', false); // Disable mongoose buffering
        
        // Enable query result caching
        mongoose.set('strictQuery', true);
        
        logger.info('Database optimization settings applied');
    }
    
    /**
     * Get optimized connection options for MongoDB
     */
    public static getConnectionOptions(): any {
        return {
            maxPoolSize: 10, // Maximum number of connections
            minPoolSize: 5,  // Minimum number of connections
            maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
            serverSelectionTimeoutMS: 5000, // How long to try selecting a server
            socketTimeoutMS: 45000, // How long a send or receive on a socket can take
            bufferMaxEntries: 0, // Disable mongoose buffering
        };
    }
    
    /**
     * Monitor database performance
     */
    public static monitorPerformance(): void {
        // Monitor slow queries
        mongoose.set('debug', (collectionName: string, method: string, query: any, doc: any) => {
            const startTime = Date.now();
            
            // Log queries that take longer than 100ms
            setTimeout(() => {
                const duration = Date.now() - startTime;
                if (duration > 100) {
                    logger.warn(`Slow MongoDB query detected: ${collectionName}.${method}`, {
                        collection: collectionName,
                        method,
                        query,
                        duration: `${duration}ms`
                    });
                }
            }, 0);
        });
        
        // Monitor connection events
        mongoose.connection.on('connected', () => {
            logger.info('MongoDB connected successfully');
        });
        
        mongoose.connection.on('error', (error) => {
            logger.error('MongoDB connection error:', error);
        });
        
        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
        });
        
        // Monitor connection pool
        setInterval(() => {
            const stats = {
                readyState: mongoose.connection.readyState,
                host: mongoose.connection.host,
                port: mongoose.connection.port,
                name: mongoose.connection.name
            };
            
            logger.debug('MongoDB connection stats:', stats);
        }, 60000); // Log every minute
    }
    
    /**
     * Create database indexes for better query performance
     */
    public static async createIndexes(): Promise<void> {
        try {
            const db = mongoose.connection.db;
            
            if (!db) {
                logger.warn('Database not connected, skipping index creation');
                return;
            }
            
            // Create indexes for matches collection
            await db.collection('matches').createIndex({ eventId: 1 }, { background: true });
            await db.collection('matches').createIndex({ gameId: 1 }, { background: true });
            await db.collection('matches').createIndex({ status: 1, eventTime: 1 }, { background: true });
            await db.collection('matches').createIndex({ createdAt: -1 }, { background: true });
            
            // Create indexes for fancyodds collection
            await db.collection('fancyodds').createIndex({ gameId: 1 }, { background: true });
            await db.collection('fancyodds').createIndex({ matchId: 1 }, { background: true });
            await db.collection('fancyodds').createIndex({ gameId: 1, isActive: 1, isEnabled: 1 }, { background: true });
            await db.collection('fancyodds').createIndex({ marketId: 1, gameId: 1 }, { background: true });
            
            logger.info('Database indexes created successfully');
        } catch (error) {
            logger.error('Failed to create database indexes:', error);
        }
    }
    
    /**
     * Get database performance statistics
     */
    public static async getPerformanceStats(): Promise<any> {
        try {
            const db = mongoose.connection.db;
            
            if (!db) {
                return { error: 'Database not connected' };
            }
            
            const stats = await db.stats();
            const serverStatus = await db.admin().serverStatus();
            
            return {
                database: {
                    collections: stats.collections,
                    dataSize: stats.dataSize,
                    indexSize: stats.indexSize,
                    storageSize: stats.storageSize
                },
                connections: {
                    current: serverStatus.connections?.current || 0,
                    available: serverStatus.connections?.available || 0,
                    totalCreated: serverStatus.connections?.totalCreated || 0
                },
                opcounters: serverStatus.opcounters,
                memory: serverStatus.mem
            };
        } catch (error) {
            logger.error('Failed to get database performance stats:', error);
            return { error: error.message };
        }
    }
}

/**
 * Query optimization utilities
 */
export class QueryOptimizer {
    /**
     * Create optimized aggregation pipeline for match queries
     */
    public static createMatchAggregationPipeline(filters: any = {}, limit: number = 50): any[] {
        const pipeline: any[] = [];
        
        // Add match stage if filters provided
        if (Object.keys(filters).length > 0) {
            pipeline.push({ $match: filters });
        }
        
        // Add lookup for fancy odds
        pipeline.push({
            $lookup: {
                from: 'fancyodds',
                localField: 'gameId',
                foreignField: 'gameId',
                as: 'fancyOdds',
                pipeline: [
                    {
                        $match: {
                            isActive: true,
                            isEnabled: true
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            id: 1,
                            marketId: 1,
                            market: 1,
                            sid: 1,
                            b1: 1,
                            bs1: 1,
                            l1: 1,
                            ls1: 1,
                            status: 1,
                            min: 1,
                            max: 1,
                            rname: 1,
                            isDeclared: 1
                        }
                    }
                ]
            }
        });
        
        // Add sorting
        pipeline.push({ $sort: { createdAt: -1 } });
        
        // Add limit
        pipeline.push({ $limit: limit });
        
        return pipeline;
    }
    
    /**
     * Create lean query options for better performance
     */
    public static createLeanQueryOptions(fields?: string[]): any {
        const options: any = {
            lean: true, // Return plain JavaScript objects
            maxTimeMS: 5000 // 5 second timeout
        };
        
        if (fields && fields.length > 0) {
            options.select = fields.join(' ');
        }
        
        return options;
    }
}