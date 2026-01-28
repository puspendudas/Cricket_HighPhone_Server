/**
 * Ultra-Fast Index Creation Script
 * Creates all necessary indexes for sub-150ms response times
 * Run this script after deployment to ensure optimal performance
 */

import mongoose from 'mongoose';
import MatchModel from '../models/match.model';
import FancyOddsModel from '../models/fancyodds.model';
import { logger } from '../utils/logger';
import DB from '../databases/index';

export class UltraFastIndexCreator {
    /**
     * Create all ultra-performance indexes
     */
    public static async createAllIndexes(): Promise<void> {
        try {
            logger.info('Starting ultra-fast index creation...');
            
            // Create match indexes
            await this.createMatchIndexes();
            
            // Create fancyOdds indexes
            await this.createFancyOddsIndexes();
            
            // Verify index creation
            await this.verifyIndexes();
            
            logger.info('Ultra-fast indexes created successfully!');
        } catch (error: any) {
            logger.error('Failed to create ultra-fast indexes:', error.message);
            throw error;
        }
    }
    
    /**
     * Create optimized indexes for Match collection
     */
    private static async createMatchIndexes(): Promise<void> {
        try {
            logger.info('Creating Match collection indexes...');
            
            const matchCollection = MatchModel.collection;
            
            // Drop existing indexes (except _id) to recreate optimized ones
            const existingIndexes = await matchCollection.getIndexes();
            for (const indexName of Object.keys(existingIndexes)) {
                if (indexName !== '_id_') {
                    try {
                        await matchCollection.dropIndex(indexName);
                        logger.info(`Dropped existing index: ${indexName}`);
                    } catch (error) {
                        // Index might not exist, continue
                    }
                }
            }
            
            // Create ultra-optimized indexes
            const matchIndexes = [
                // Primary lookup index with uniqueness
                { key: { eventId: 1 }, options: { unique: true, background: true } },
                
                // Secondary lookup index
                { key: { gameId: 1 }, options: { background: true } },
                
                // Status filtering with time sorting
                { key: { status: 1, eventTime: 1 }, options: { background: true } },
                
                // Recent matches sorting
                { key: { createdAt: -1 }, options: { background: true } },
                
                // Combined lookup optimization
                { key: { eventId: 1, gameId: 1 }, options: { background: true } },
                
                // Game status queries
                { key: { gameId: 1, status: 1 }, options: { background: true } },
                
                // Live match filtering
                { key: { status: 1, inPlay: 1, eventTime: 1 }, options: { background: true } }
            ];
            
            for (const index of matchIndexes) {
                await matchCollection.createIndex(index.key, index.options);
                logger.info(`Created Match index: ${JSON.stringify(index.key)}`);
            }
            
            logger.info('Match indexes created successfully!');
        } catch (error: any) {
            logger.error('Failed to create Match indexes:', error.message);
            throw error;
        }
    }
    
    /**
     * Create optimized indexes for FancyOdds collection
     */
    private static async createFancyOddsIndexes(): Promise<void> {
        try {
            logger.info('Creating FancyOdds collection indexes...');
            
            const fancyOddsCollection = FancyOddsModel.collection;
            
            // Drop existing indexes (except _id) to recreate optimized ones
            const existingIndexes = await fancyOddsCollection.getIndexes();
            for (const indexName of Object.keys(existingIndexes)) {
                if (indexName !== '_id_') {
                    try {
                        await fancyOddsCollection.dropIndex(indexName);
                        logger.info(`Dropped existing FancyOdds index: ${indexName}`);
                    } catch (error) {
                        // Index might not exist, continue
                    }
                }
            }
            
            // Create ultra-optimized indexes
            const fancyOddsIndexes = [
                // Primary lookup index for gameId queries
                { key: { gameId: 1 }, options: { background: true } },
                
                // Reference lookup index
                { key: { matchId: 1 }, options: { background: true } },
                
                // Compound index for active odds (most important for aggregation)
                { key: { gameId: 1, isActive: 1, isEnabled: 1 }, options: { background: true } },
                
                // Market-specific queries
                { key: { marketId: 1, gameId: 1 }, options: { background: true } },
                
                // Fast active filtering
                { key: { gameId: 1, isActive: 1 }, options: { background: true } },
                
                // Fast enabled filtering
                { key: { gameId: 1, isEnabled: 1 }, options: { background: true } },
                
                // Optimized for aggregation pipeline (order matters!)
                { key: { isActive: 1, isEnabled: 1, gameId: 1 }, options: { background: true } },
                
                // Session-specific queries
                { key: { gameId: 1, sid: 1 }, options: { background: true } }
            ];
            
            for (const index of fancyOddsIndexes) {
                await fancyOddsCollection.createIndex(index.key, index.options);
                logger.info(`Created FancyOdds index: ${JSON.stringify(index.key)}`);
            }
            
            logger.info('FancyOdds indexes created successfully!');
        } catch (error: any) {
            logger.error('Failed to create FancyOdds indexes:', error.message);
            throw error;
        }
    }
    
    /**
     * Verify all indexes are created and get performance stats
     */
    private static async verifyIndexes(): Promise<void> {
        try {
            logger.info('Verifying index creation...');
            
            // Get Match collection indexes
            const matchIndexes = await MatchModel.collection.getIndexes();
            logger.info(`Match collection has ${Object.keys(matchIndexes).length} indexes:`);
            Object.keys(matchIndexes).forEach(indexName => {
                logger.info(`  - ${indexName}: ${JSON.stringify(matchIndexes[indexName])}`);
            });
            
            // Get FancyOdds collection indexes
            const fancyOddsIndexes = await FancyOddsModel.collection.getIndexes();
            logger.info(`FancyOdds collection has ${Object.keys(fancyOddsIndexes).length} indexes:`);
            Object.keys(fancyOddsIndexes).forEach(indexName => {
                logger.info(`  - ${indexName}: ${JSON.stringify(fancyOddsIndexes[indexName])}`);
            });
            
            // Get collection document counts
            const matchCount = await MatchModel.countDocuments();
            const fancyOddsCount = await FancyOddsModel.countDocuments();
            
            logger.info('Collection Statistics:');
            logger.info(`Match collection: ${matchCount} documents`);
            logger.info(`FancyOdds collection: ${fancyOddsCount} documents`);
            
        } catch (error: any) {
            logger.error('Failed to verify indexes:', error.message);
            throw error;
        }
    }
    
    /**
     * Test query performance with explain
     */
    public static async testQueryPerformance(eventId: string): Promise<void> {
        try {
            logger.info(`Testing query performance for eventId: ${eventId}`);
            
            // Test Match query performance
            const matchExplain = await MatchModel.collection.find({ eventId }).explain('executionStats');
            logger.info('Match Query Performance:');
            logger.info(`  - Execution time: ${matchExplain.executionStats.executionTimeMillis}ms`);
            logger.info(`  - Documents examined: ${matchExplain.executionStats.totalDocsExamined}`);
            logger.info(`  - Index used: ${matchExplain.executionStats.executionStages.indexName || 'NONE'}`);
            
            // Get gameId for FancyOdds test
            const match = await MatchModel.findOne({ eventId }).select('gameId').lean();
            if (match) {
                const fancyOddsExplain = await FancyOddsModel.collection.find({
                    gameId: match.gameId,
                    isActive: true,
                    isEnabled: true
                }).explain('executionStats');
                
                logger.info('FancyOdds Query Performance:');
                logger.info(`  - Execution time: ${fancyOddsExplain.executionStats.executionTimeMillis}ms`);
                logger.info(`  - Documents examined: ${fancyOddsExplain.executionStats.totalDocsExamined}`);
                logger.info(`  - Index used: ${fancyOddsExplain.executionStats.executionStages.indexName || 'NONE'}`);
            }
            
        } catch (error: any) {
            logger.error('Failed to test query performance:', error.message);
        }
    }
}

export default UltraFastIndexCreator;