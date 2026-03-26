import axios from 'axios';
import mongoose from 'mongoose';
import { logger } from '@utils/logger';
import FancyOddsModel from '@/models/fancyodds.model';
import MatchModel from '@/models/match.model';
import MatchBetService from '@/services/matchBet.service';

class AutoDeclareService {
  private fancyOdds = FancyOddsModel;
  private match = MatchModel;
  private matchBetService = new MatchBetService();

  private readonly fancyResultApiUrl = process.env.FANCY_RESULT_API_URL || 'https://data.hpterminal.com/betfair-result';
  private readonly fancyResultMarketParam = process.env.FANCY_RESULT_MARKET_PARAM || 'marketId';
  private readonly fancyResultSport = process.env.FANCY_RESULT_SPORT || 'cricket';
  private readonly fancyResultType = process.env.FANCY_RESULT_TYPE || 'NEW_FANCY';

  private readonly requestHeaders = {
    'User-Agent': 'CricketApp/1.0',
    'Accept': 'application/json'
  };

  public async runAutoDeclareJob(): Promise<{ checked: number; declared: number; errors: number }> {
    let checked = 0;
    let declared = 0;
    let errors = 0;

    try {
      logger.info('[AutoDeclare] Job started');
      const activeMatches = await this.match.find(
        { status: true, declared: false },
        { gameId: 1 }
      ).lean();
      const gameIds = activeMatches
        .map(match => match?.gameId)
        .filter((gameId): gameId is string => this.isValidGameId(gameId));
      logger.info(`[AutoDeclare] Active matches: ${gameIds.length}`);

      if (gameIds.length === 0) {
        return { checked, declared, errors };
      }

      const activeFancyOdds = await this.fancyOdds.find({
        gameId: { $in: gameIds },
        isActive: true,
        isDeclared: false
      }).lean();

      logger.info(`[AutoDeclare] Active fancy odds: ${activeFancyOdds.length}`);

      for (const fancy of activeFancyOdds) {
        checked += 1;
        const rawMarketId = (fancy.marketId || fancy.id || '').toString();
        const marketId = this.buildFancyMarketId(rawMarketId, fancy.gameId?.toString(), Number(fancy.sid));
        logger.info(`[AutoDeclare] sid ${fancy.sid} marketId ${marketId || 'N/A'}`);
        if (!marketId) {
          logger.warn(`[AutoDeclare] Missing marketId for sid ${fancy.sid}`);
          continue;
        }

        logger.info(`[AutoDeclare] Fetching result for marketId ${marketId}`);
        const run = await this.fetchFancyResultByMarketId(marketId);

        if (run === null) {
          logger.info(`[AutoDeclare] No result for marketId ${marketId}`);
          continue;
        }

        try {
          await this.matchBetService.settleFancyBets(
            fancy.matchId.toString(),
            Number(fancy.sid),
            run,
            fancy._id.toString()
          );

          await this.fancyOdds.updateOne(
            { _id: fancy._id },
            { $set: { isAuto: true } }
          );

          declared += 1;
          logger.info(`[AutoDeclare] Declared sid ${fancy.sid} marketId ${marketId} run ${run}`);
        } catch (error: any) {
          errors += 1;
          logger.warn(`[AutoDeclare] Failed to auto-declare sid ${fancy.sid}: ${error.message}`);
        }
      }
    } catch (error: any) {
      errors += 1;
      logger.error('[AutoDeclare] Job failed:', error.message);
    }

    logger.info(`[AutoDeclare] Job completed checked=${checked} declared=${declared} errors=${errors}`);
    return { checked, declared, errors };
  }

  /**
   * Run auto-declare for a single match only (all SIDs for that event).
   * Used by the run API. Cron continues to use runAutoDeclareJob() for all matches.
   */
  public async runAutoDeclareForMatch(matchId: string): Promise<{ checked: number; declared: number; errors: number }> {
    let checked = 0;
    let declared = 0;
    let errors = 0;

    try {
      if (!matchId || !mongoose.Types.ObjectId.isValid(matchId)) {
        logger.warn('[AutoDeclare] runAutoDeclareForMatch: invalid matchId');
        return { checked, declared, errors };
      }

      const match = await this.match.findById(matchId).select('gameId status declared').lean();
      if (!match) {
        logger.warn(`[AutoDeclare] runAutoDeclareForMatch: match not found ${matchId}`);
        return { checked, declared, errors };
      }
      if (!match.status || match.declared) {
        logger.info(`[AutoDeclare] runAutoDeclareForMatch: match ${matchId} not active or already declared`);
        return { checked, declared, errors };
      }

      const activeFancyOdds = await this.fancyOdds.find({
        matchId: new mongoose.Types.ObjectId(matchId),
        isActive: true,
        isDeclared: false
      }).lean();

      logger.info(`[AutoDeclare] runAutoDeclareForMatch matchId=${matchId} fancy count=${activeFancyOdds.length}`);

      for (const fancy of activeFancyOdds) {
        checked += 1;
        const rawMarketId = (fancy.marketId || fancy.id || '').toString();
        const marketId = this.buildFancyMarketId(rawMarketId, fancy.gameId?.toString(), Number(fancy.sid));
        logger.info(`[AutoDeclare] sid ${fancy.sid} marketId ${marketId || 'N/A'}`);
        if (!marketId) {
          logger.warn(`[AutoDeclare] Missing marketId for sid ${fancy.sid}`);
          continue;
        }

        logger.info(`[AutoDeclare] Fetching result for marketId ${marketId}`);
        const run = await this.fetchFancyResultByMarketId(marketId);

        if (run === null) {
          logger.info(`[AutoDeclare] No result for marketId ${marketId}`);
          continue;
        }

        try {
          await this.matchBetService.settleFancyBets(
            fancy.matchId.toString(),
            Number(fancy.sid),
            run,
            fancy._id.toString()
          );

          await this.fancyOdds.updateOne(
            { _id: fancy._id },
            { $set: { isAuto: true } }
          );

          declared += 1;
          logger.info(`[AutoDeclare] Declared sid ${fancy.sid} marketId ${marketId} run ${run}`);
        } catch (error: any) {
          errors += 1;
          logger.warn(`[AutoDeclare] Failed to auto-declare sid ${fancy.sid}: ${error.message}`);
        }
      }

      logger.info(`[AutoDeclare] runAutoDeclareForMatch completed matchId=${matchId} checked=${checked} declared=${declared} errors=${errors}`);
    } catch (error: any) {
      errors += 1;
      logger.error(`[AutoDeclare] runAutoDeclareForMatch failed for matchId ${matchId}:`, error.message);
    }

    return { checked, declared, errors };
  }

  private async fetchFancyResultByMarketId(marketId: string): Promise<number | null> {
    try {
      const url = this.buildFancyResultUrl(marketId);

      const response = await axios.get(url, {
        timeout: 10000,
        headers: this.requestHeaders
      });

      const payload = response.data?.data ?? response.data;
      return this.extractRunFromResultPayload(payload);
    } catch (error: any) {
      logger.warn(`[AutoDeclare] Fancy result API failed for marketId ${marketId}: ${error.message}`);
      return null;
    }
  }

  private buildFancyResultUrl(marketId: string): string {
    const connector = this.fancyResultApiUrl.includes('?') ? '&' : '?';
    return `${this.fancyResultApiUrl}${connector}${this.fancyResultMarketParam}=${encodeURIComponent(marketId)}&sport=${encodeURIComponent(this.fancyResultSport)}&type=${encodeURIComponent(this.fancyResultType)}`;
  }

  private buildFancyMarketId(baseMarketId: string, gameId: string | undefined, sid: number): string {
    if (baseMarketId && baseMarketId.includes('_')) return baseMarketId;
    if (gameId && sid && !Number.isNaN(sid)) {
      return `${gameId}_${sid}`;
    }
    if (!baseMarketId) return '';
    if (!sid || Number.isNaN(sid)) return baseMarketId;
    return `${baseMarketId}_${sid}`;
  }

  private extractRunFromResultPayload(payload: any): number | null {
    if (payload == null) return null;

    if (Array.isArray(payload)) {
      const match = payload.find((item: any) => item?.result ?? item?.score ?? item?.run ?? item?.runs ?? item?.resultScore);
      return this.normalizeResultValue(match?.result ?? match?.score ?? match?.run ?? match?.runs ?? match?.resultScore);
    }

    if (typeof payload === 'object') {
      if (payload.data) {
        return this.extractRunFromResultPayload(payload.data);
      }

      return this.normalizeResultValue(payload?.result ?? payload?.score ?? payload?.run ?? payload?.runs ?? payload?.resultScore);
    }

    return this.normalizeResultValue(payload);
  }

  private normalizeResultValue(value: any): number | null {
    if (value == null || value === '') return null;

    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
    if (Number.isNaN(parsed)) return null;

    return parsed;
  }

  private isValidGameId(gameId: any): gameId is string {
    if (!gameId) return false;
    const value = String(gameId).trim();
    if (!/^\d+$/.test(value)) return false;
    return value.length === 8;
  }
}

export default AutoDeclareService;
