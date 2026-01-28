// optimizedMatch.service.ts

import { logger } from '../utils/logger';
import axios, { AxiosResponse } from 'axios';
import MatchModel from '../models/match.model';
import FancyOddsService from './fancyodds.service';
import mongoose from 'mongoose';
import { performance } from 'perf_hooks';


/**
 * OptimizedMatchService handles match-related operations with performance optimizations
 * Includes connection pooling, batch processing, and efficient database queries
 */
class OptimizedMatchService {
  public match = MatchModel;
  private fancyOddsService: FancyOddsService;
  private readonly API_TIMEOUT = 15000; // 15 seconds
  private readonly BATCH_SIZE = 50; // Process matches in batches
  private readonly MAX_CONCURRENT_REQUESTS = 3; // Limit concurrent API calls
  private readonly CACHE_TTL = 5000; // 5 seconds cache for repeated requests
  private apiCache: Map<string, { data: any; timestamp: number }> = new Map();
  private requestQueue: Array<() => Promise<any>> = [];
  private activeRequests = 0;
  private lastExecutionTime = 0;
  private executionCount = 0;
  private errorCount = 0;

  constructor() {
    this.fancyOddsService = new FancyOddsService();

    // Clean cache periodically
    setInterval(() => {
      this.cleanCache();
    }, 30000); // Clean every 30 seconds
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.apiCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.apiCache.delete(key);
      }
    }
  }

  /**
   * Check if database connection is healthy
   */
  private isDatabaseConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Execute API request with caching and rate limiting
   */
  private async executeAPIRequest<T>(url: string, cacheKey?: string): Promise<T> {
    // Check cache first
    if (cacheKey && this.apiCache.has(cacheKey)) {
      const cached = this.apiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    // Rate limiting
    if (this.activeRequests >= this.MAX_CONCURRENT_REQUESTS) {
      await new Promise(() => {
        this.requestQueue.push(() => Promise.resolve(undefined));
      });
    }

    this.activeRequests++;

    try {
      const response: AxiosResponse<T> = await axios.get(url, {
        timeout: this.API_TIMEOUT,
        headers: {
          'User-Agent': 'Cricket-Backend/1.0',
          'Accept': 'application/json',
          'Connection': 'keep-alive'
        }
      });

      // Cache the response
      if (cacheKey) {
        this.apiCache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now()
        });
      }

      return response.data;
    } finally {
      this.activeRequests--;

      // Process next request in queue
      if (this.requestQueue.length > 0) {
        const nextRequest = this.requestQueue.shift();
        if (nextRequest) {
          setImmediate(nextRequest);
        }
      }
    }
  }

  /**
   * Optimized cron job that runs both match and odds updates efficiently
   */
  public async runOptimizedCronJob(): Promise<void> {
    const startTime = performance.now();
    this.executionCount++;

    try {
      // Check database connection
      if (!this.isDatabaseConnected()) {
        logger.warn('[OptimizedMatchService] Database not connected, skipping cron job');
        return;
      }

      // Prevent overlapping executions
      const timeSinceLastExecution = Date.now() - this.lastExecutionTime;
      if (this.lastExecutionTime > 0 && timeSinceLastExecution < 800) {
        logger.debug('[OptimizedMatchService] Skipping execution - too soon since last run');
        return;
      }

      this.lastExecutionTime = Date.now();

      // Run both operations concurrently with proper error handling
      const [matchResult, oddsResult] = await Promise.allSettled([
        this.getMatchByCronJobOptimized(),
        this.getMatchOddsDataByStatusCronJobOptimized()
      ]);

      // Log results
      if (matchResult.status === 'rejected') {
        logger.error('[OptimizedMatchService] Match fetch failed:', matchResult.reason);
        this.errorCount++;
      }

      if (oddsResult.status === 'rejected') {
        logger.error('[OptimizedMatchService] Odds fetch failed:', oddsResult.reason);
        this.errorCount++;
      }

      const executionTime = performance.now() - startTime;

      // Log performance metrics
      if (executionTime > 5000) {
        logger.warn(`[OptimizedMatchService] Slow execution: ${executionTime.toFixed(2)}ms`);
      }

      // Log stats every 100 executions
      if (this.executionCount % 100 === 0) {
        logger.info(`[OptimizedMatchService] Stats - Executions: ${this.executionCount}, Errors: ${this.errorCount}, Avg Time: ${executionTime.toFixed(2)}ms`);
      }

    } catch (error) {
      this.errorCount++;
      logger.error('[OptimizedMatchService] Cron job error:', error);
    }
  }

  /**
   * Optimized match fetching with efficient database operations
   */
  private async getMatchByCronJobOptimized(): Promise<void> {
    try {
      // Fetch matches from API with caching
      const response = await this.executeAPIRequest<any>(
        'https://terminal.hpterminal.com/cricket/matches',
        'matches_data'
      );

      const matches = response?.data?.data?.data;
      if (!matches || !Array.isArray(matches)) {
        logger.debug('[OptimizedMatchService] No valid match data received');
        return;
      }
      if (matches.length === 0) {
        return;
      }

      // Get existing match IDs in a single query
      const existingGameIds = await this.match.distinct('gameId', {
        gameId: { $in: matches.map((match: any) => match.gameId) }
      }).lean();

      const existingGameIdsSet = new Set(existingGameIds);

      // Filter new matches
      const newMatches = matches.filter((match: any) =>
        match.gameId && !existingGameIdsSet.has(match.gameId)
      );

      if (newMatches.length === 0) {
        logger.debug('[OptimizedMatchService] No new matches to insert');
        return;
      }

      // Process matches in batches
      const batches = this.chunkArray(newMatches, this.BATCH_SIZE);
      let totalInserted = 0;

      for (const batch of batches) {
        try {
          // Bulk insert with ordered: false for better performance
          const result = await this.match.insertMany(batch, {
            ordered: false,
            lean: true
          });

          totalInserted += result.length;
          logger.debug(`[OptimizedMatchService] Inserted batch of ${result.length} matches`);

        } catch (batchError: any) {
          // Handle duplicate key errors gracefully
          if (batchError.code === 11000) {
            logger.debug('[OptimizedMatchService] Some matches already exist in batch');
          } else {
            logger.error('[OptimizedMatchService] Batch insert error:', batchError);
          }
        }
      }

      if (totalInserted > 0) {
        logger.info(`[OptimizedMatchService] Successfully inserted ${totalInserted} new matches`);
      }

    } catch (error) {
      logger.error('[OptimizedMatchService] Error in getMatchByCronJobOptimized:', error);
      throw error;
    }
  }

  /**
   * Optimized odds fetching with efficient database operations
   */
  private async getMatchOddsDataByStatusCronJobOptimized(): Promise<void> {
    try {
      // Get active matches with projection to reduce memory usage
      const activeMatches = await this.match.find(
        { status: true },
        { gameId: 1, teams: 1, _id: 1 }
      ).lean().limit(100); // Limit to prevent memory issues

      if (activeMatches.length === 0) {
        logger.debug('[OptimizedMatchService] No active matches found');
        return;
      }

      logger.debug(`[OptimizedMatchService] Processing odds for ${activeMatches.length} active matches`);

      // Process matches in smaller batches to prevent overwhelming the API
      const batches = this.chunkArray(activeMatches, 10);

      for (const batch of batches) {
        await Promise.allSettled(
          batch.map(match => this.processMatchOddsOptimized(match))
        );

        // Small delay between batches to prevent API rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      logger.error('[OptimizedMatchService] Error in getMatchOddsDataByStatusCronJobOptimized:', error);
      throw error;
    }
  }

  /**
   * Process odds for a single match with optimized database operations
   */
  private async processMatchOddsOptimized(match: any): Promise<void> {
    try {
      const { gameId, _id } = match;

      // Fetch odds data with caching
      const response = await this.executeAPIRequest<any>(
        `https://terminal.hpterminal.com/cricket/odds?gameId=${gameId}`,
        `odds_${gameId}`
      );

      const data = response?.data;
      if (!data) {
        // logger.warn(`[OptimizedMatchService] No odds data received for match ${gameId}`);
        return;
      }

      // Extract team names from odds data for first time only
      const teams = this.extractTeamNames(data);
      const updateData: any = {
        matchOdds: data.matchOdds || [],
        bookMakerOdds: data.bookMakerOdds || [],
        otherMarketOdds: data.otherMarketOdds || [],
      };

      if (teams.length > 0) {
        updateData.teams = teams;
      }

      // Update match with all odds data in one operation
      await this.match.findByIdAndUpdate(_id, updateData, { lean: true });

      // Handle fancyOdds separately using the service
      const fancyOdds = data.fancyOdds;
      if (fancyOdds && Array.isArray(fancyOdds) && fancyOdds.length > 0) {
        await this.fancyOddsService.bulkCreateOrUpdate(fancyOdds, _id.toString(), gameId);
      }

    } catch (error) {
      logger.error(`[OptimizedMatchService] Error processing odds for match ${match.gameId}:`, error);
    }
  }

  /**
   * Extract team names from odds data
   */
  private extractTeamNames(data: any): string[] {
    const teams: string[] = [];

    // Try matchOdds first, then bookMakerOdds as fallback
    const oddsSource = data.matchOdds?.[0]?.oddDatas || data.bookMakerOdds?.[0]?.oddDatas;

    if (oddsSource && Array.isArray(oddsSource)) {
      teams.push(...oddsSource
        .filter((item: any) => item?.rname)
        .map((item: any) => item.rname)
      );
    }

    return teams;
  }

  /**
   * Utility function to chunk array into smaller batches
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): any {
    return {
      executionCount: this.executionCount,
      errorCount: this.errorCount,
      errorRate: this.executionCount > 0 ? this.errorCount / this.executionCount : 0,
      lastExecutionTime: this.lastExecutionTime,
      cacheSize: this.apiCache.size,
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length
    };
  }

  /**
   * Clear cache and reset counters
   */
  public resetStats(): void {
    this.executionCount = 0;
    this.errorCount = 0;
    this.apiCache.clear();
    this.requestQueue = [];
  }
}

export default OptimizedMatchService;
