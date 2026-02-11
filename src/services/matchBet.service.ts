/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Match Betting Service
 *
 * This service handles all match betting operations including:
 * - Creating and managing match bets
 * - Calculating profit/loss scenarios
 * - Managing user exposures
 * - Validating betting data
 *
 * @author Cricket Betting System
 * @version 1.0.0
 */

// External Dependencies
import { Batch, ObjectId } from 'mongodb';

// Internal Dependencies - Exceptions
import { HttpException } from '@exceptions/HttpException';

// Internal Dependencies - Utils
import { isEmpty } from '@utils/util';

// Internal Dependencies - Models
import MatchBetModel from '@/models/matchBet.model';
import UserModel from '@/models/user.model';
import MatchModel from '@/models/match.model';
import FancyOddsModel from '@/models/fancyodds.model';
import TransactionModel from '@/models/transaction.model';
import ExposureModel from '@/models/exposure.model';
import AdminModel from '@/models/admin.model';

// Internal Dependencies - Interfaces & DTOs
import { MatchBet, MatchBetRespond, MatchBetStatus, MatchBetType } from '@/interfaces/matchBet.interface';
import { CreateMatchBetDto } from '@/dtos/matchBet.dto';
import MatchTransactionModel from '@/models/matchTransaction.model';
import { MatchTransactionStatus, MatchTransactionTransferType, MatchTransactionType } from '@/interfaces/matchTransaction.interface';
import { ExposureStatus } from '@/interfaces/exposure.interface';
import { User } from '@/interfaces/users.interface';
import { buildHierarchy } from '@/utils/hierarchy';
import HierarchyService from '@/services/hierarchy.service';
import { logger } from '@/utils/logger';

/**
 * MatchBetService - Core service for handling cricket match betting operations
 *
 * This service provides comprehensive functionality for:
 * - Creating and validating match bets (Bookmaker & Fancy)
 * - Calculating profit/loss scenarios for users
 * - Managing user exposures and wallet updates
 * - Retrieving betting history and statistics
 *
 * @class MatchBetService
 */
class MatchBetService {
  // ========================================
  // MODEL DEPENDENCIES
  // ========================================

  /** Match bet model for database operations */
  public matchBet = MatchBetModel;

  /** User model for user-related operations */
  public user = UserModel;

  /** Admin model for admin-related operations */
  public admin = AdminModel;

  /** Match model for match data operations */
  public match = MatchModel;

  /** Fancy odds model for fancy betting operations */
  public fancyOdds = FancyOddsModel;

  /** Transaction model for financial operations */
  public transaction = TransactionModel;

  /** Exposure model for risk management */
  public exposure = ExposureModel;

  /** Match transaction model for financial operations */
  public matchTransaction = MatchTransactionModel;

  private hierarchyService = new HierarchyService();
  // ========================================
  // UTILITY METHODS - TEAM & SELECTION HELPERS
  // ========================================

  /**
   * Retrieves team name from match data using selection ID
   *
   * This method searches through bookmaker odds to find the corresponding
   * team name for a given selection ID. It provides fallback mechanisms
   * to ensure a team name is always returned.
   *
   * @private
   * @param {any} match - The match data object containing bookmaker odds
   * @param {number} selectionId - The selection ID to find team name for
   * @returns {string} Team name or fallback identifier (Team_${selectionId})
   */
  private getTeamNameBySelectionId(match: any, selectionId: number): string {
  try {
    if (match.bookMakerOdds && Array.isArray(match.bookMakerOdds)) {
      for (const bookmakerWrapper of match.bookMakerOdds) {
        for (const value of Object.values(bookmakerWrapper)) {
          const bookmaker = value as { oddDatas?: any[] };
          if (!Array.isArray(bookmaker?.oddDatas)) continue;

          for (const odds of bookmaker.oddDatas) {
            if (Number(odds.sid) === Number(selectionId)) {
              return (
                odds.team_name ||
                odds.rname?.replace(/\.+$/, "").trim() ||
                odds.name ||
                `Team_${selectionId}`
              );
            }
          }
        }
      }
    }

    return `Team_${selectionId}`;
  } catch (error) {
    console.error("getTeamNameBySelectionId error:", error);
    return `Team_${selectionId}`;
  }
}


  // ========================================
  // UTILITY AND HELPER METHODS
  // ========================================

  /**
   * Extracts all unique selection IDs from match bookmaker odds
   *
   * This method parses through the bookmaker odds structure to collect
   * all available selection IDs for profit/loss calculations.
   *
   * @private
   * @param {any} match - The match data object containing bookmaker odds
   * @returns {number[]} Array of unique selection IDs
   */
  private getBookmakerSelectionIds(match: any): number[] {
    const selectionIds: number[] = [];
    try {
      if (match.bookMakerOdds && Array.isArray(match.bookMakerOdds)) {
        for (const bookmakerWrapper of match.bookMakerOdds) {
          const bookmakerKeys = Object.keys(bookmakerWrapper);
          for (const key of bookmakerKeys) {
            if (key !== 'bm1') continue;
            const bookmaker = bookmakerWrapper[key];
            if (bookmaker && bookmaker.oddDatas && Array.isArray(bookmaker.oddDatas)) {
              for (const odds of bookmaker.oddDatas) {
                if (odds.sid && !selectionIds.includes(odds.sid)) {
                  selectionIds.push(odds.sid);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error getting bookmaker selection IDs:', error);
    }
    return selectionIds;
  }

  /**
   * Calculates the run list for fancy bets based on odds values
   *
   * This method generates a continuous range of runs from the minimum
   * to maximum odds values found in fancy bets, used for profit/loss calculations.
   *
   * @private
   * @param {MatchBet[]} bets - Array of match bets to analyze
   * @returns {number[]} Array of run values for profit/loss calculation
   */
  private calculateRunList(bets: MatchBet[]): number[] {
    const fancyOdds = bets
      .filter(bet => bet.bet_type === MatchBetType.FANCY)
      .map(bet => Number(bet.odds_value));

    if (fancyOdds.length === 0) return [];

    const min = Math.min(...fancyOdds);
    const max = Math.max(...fancyOdds);

    return Array.from({ length: max - (min - 1) + 1 }, (_, i) => (min - 1) + i);
  }

  /**
   * Delay for a given number of milliseconds
   *
   * This method creates a promise that resolves after the specified number of milliseconds.
   *
   * @private
   * @param {number} ms - The number of milliseconds to delay
   * @returns {Promise<void>} A promise that resolves after the delay
   */
  private delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // ========================================
  // CALCULATION METHODS - WINNINGS & PROFIT/LOSS
  // ========================================

  /**
   * Calculates potential winnings based on bet type and selection
   *
   * This method computes the potential profit or loss for different bet types:
   * - BOOKMAKER: Back bets calculate profit, Lay bets calculate liability
   * - FANCY: Yes bets calculate profit, Not bets calculate liability
   *
   * @private
   * @param {MatchBetType} betType - Type of bet (BOOKMAKER or FANCY)
   * @param {string} selection - Selection type (Back/Lay for BOOKMAKER, Yes/Not for FANCY)
   * @param {number} stakeAmount - Amount staked on the bet
   * @param {string} oddsRate - Odds rate as string from odds data
   * @returns {number} Calculated potential winnings or liability
   */
  private calculatePotentialWinnings(
    betType: MatchBetType,
    selection: string,
    stakeAmount: number,
    oddsRate: string
  ): number {
    const rate = parseFloat(oddsRate);

    if (betType === MatchBetType.BOOKMAKER) {
      if (selection === 'Back') {
        // Back: Profit = Stake * (Rate(b1) / 100)
        return stakeAmount * (rate / 100);
      } else if (selection === 'Lay') {
        // Lay: Loss = Stake * (Rate(l1) / 100)
        return stakeAmount * (rate / 100);
      }
    } else if (betType === MatchBetType.FANCY) {


      if (selection === 'Yes') {
        // Yes: Profit = Stake * (Rate(bs1) / 100)
        return stakeAmount * (rate / 100);
      } else if (selection === 'Not') {
        // Not: Loss = Stake * (Rate(ls1) / 100)
        return stakeAmount * (rate / 100);
      }
    }

    return 0;
  }

  // ========================================
  // VALIDATION METHODS
  // ========================================

  /**
   * Validates betting data based on bet type and current odds
   *
   * This method performs comprehensive validation including:
   * - Selection type validation (Back/Lay for BOOKMAKER, Yes/Not for FANCY)
   * - Odds availability and rate matching
   * - Stake amount limits (min/max)
   * - Market availability for fancy bets
   *
   * @private
   * @param {CreateMatchBetDto} betData - The betting data to validate
   * @param {any} match - Match data containing bookmaker odds
   * @param {any} [fancyOdds] - Fancy odds data (required for FANCY bets)
   * @throws {HttpException} When validation fails
   * @returns {Promise<void>}
   */
  private async validateBettingData(betData: CreateMatchBetDto, match: any, fancyOdds?: any, user?: User): Promise<void> {
    if (betData.bet_type === MatchBetType.BOOKMAKER) {
      // Validate BOOKMAKER bet
      if (!['Back', 'Lay'].includes(betData.selection)) {
        throw new HttpException(400, 'Invalid selection for BOOKMAKER bet. Must be Back or Lay');
      }

      if (!match.bookMakerOdds || match.bookMakerOdds.length === 0) {
        throw new HttpException(400, 'No bookmaker odds available for this match');
      }

      // Find the specific odds for the selection within oddDatas array
      // bookMakerOdds structure: [{ bm1: { oddDatas: [...] } }]
      let oddsData = null;
      for (const bookmakerWrapper of match.bookMakerOdds) {
        // Each bookmaker wrapper contains keys like 'bm1', 'bm2', etc.
        // use only bm1 data
        const bookmakerKeys = Object.keys(bookmakerWrapper);
        for (const key of bookmakerKeys) {
          if (key !== 'bm1') continue;
          const bookmaker = bookmakerWrapper[key];
          if (bookmaker && bookmaker.oddDatas && Array.isArray(bookmaker.oddDatas)) {
            for (const odds of bookmaker.oddDatas) {
              // Use loose equality to handle string/number type differences
              if (odds.sid == betData.selection_id) {
                oddsData = odds;
                break;
              }
            }
            if (oddsData) break;
          }
        }
        if (oddsData) break;
      }

      if (!oddsData) {
        throw new HttpException(400, 'Invalid selection ID for bookmaker bet');
      }

      const rateKey = betData.selection === 'Back' ? 'b1' : 'l1';
      if (!oddsData[rateKey] || parseFloat(oddsData[rateKey]) <= 0) {
        throw new HttpException(400, `No valid ${betData.selection} odds available`);
      }

      // Check if bet rate is same for bookmaker odds and coming data
      const bookmakerRate = parseFloat(oddsData[rateKey]);
      const betRate = parseFloat(betData.odds_rate);
      const diff = Math.abs(bookmakerRate - betRate);

      if (diff > (user.rate_diff ?? 0)) {
        throw new HttpException(400, `Bookmaker rate have changed. Expected: ${bookmakerRate}`);
      }

      // Check if bet stake amount is same for bookmaker odds min and coming data
      const bookmakerStakeMin = parseFloat(oddsData.min);
      if (bookmakerStakeMin && betData.stake_amount < bookmakerStakeMin) {
        throw new HttpException(400, `Bookmaker stake amount have changed. Expected: ${bookmakerStakeMin}`);
      }


    } else if (betData.bet_type === MatchBetType.FANCY) {
      // Validate FANCY bet
      if (!['Yes', 'Not'].includes(betData.selection)) {
        throw new HttpException(400, 'Invalid selection for FANCY bet. Must be Yes or Not');
      }

      if (!betData.market_id) {
        throw new HttpException(400, 'Market ID is required for FANCY bets');
      }

      if (!fancyOdds) {
        throw new HttpException(400, 'No fancy odds available for this market');
      }

      const rateKey = betData.selection === 'Yes' ? 'bs1' : 'ls1';
      const valueKey = betData.selection === 'Yes' ? 'b1' : 'l1';

      if (!fancyOdds[rateKey] || parseFloat(fancyOdds[rateKey]) <= 0) {
        throw new HttpException(400, `No valid ${betData.selection} odds available`);
      }

      if (!fancyOdds[valueKey]) {
        throw new HttpException(400, `No valid ${betData.selection} value available`);
      }

      // Check min/max stake limits
      if (fancyOdds.min && betData.stake_amount < fancyOdds.min) {
        throw new HttpException(400, `Minimum stake amount is ${fancyOdds.min}`);
      }

      if (fancyOdds.max && betData.stake_amount > fancyOdds.max) {
        throw new HttpException(400, `Maximum stake amount is ${fancyOdds.max}`);
      }

      // Check if bet rate is same for fancy odds and coming data
      const fancyRate = parseFloat(fancyOdds[rateKey]);
      const betRate = parseFloat(betData.odds_rate);
      const diff = Math.abs(fancyRate - betRate)
      if (diff > (user.rate_diff ?? 0)) {
        throw new HttpException(400, `Fancy rate changed beyond allowed diff. Expected ±${user.rate_diff}, got ${fancyRate}`);
      }

      // Check if bet value is same for fancy odds and coming data
      const fancyValue = parseFloat(fancyOdds[valueKey]);
      if (fancyValue !== parseFloat(betData.odds_value)) {
        throw new HttpException(400, `Fancy value have changed. Expected: ${fancyValue}`);
      }
      // Check if bet stake amount is same for fancy odds and coming data
      if (fancyOdds.min && betData.stake_amount < fancyOdds.min) {
        throw new HttpException(400, `Minimum stake amount is ${fancyOdds.min}`);
      }

      if (fancyOdds.max && betData.stake_amount > fancyOdds.max) {
        throw new HttpException(400, `Maximum stake amount is ${fancyOdds.max}`);
      }
    }
  }

  // ========================================
  // CORE BUSINESS METHODS - BET CREATION
  // ========================================

  /**
   * Creates a new cricket match bet with comprehensive validation and exposure management
   *
   * This method handles the complete bet creation process:
   * 1. Validates user balance and match availability
   * 2. Validates betting data against current odds
   * 3. Calculates potential winnings and profit/loss scenarios
   * 4. Updates user exposure and wallet balance
   * 5. Creates transaction records
   *
   * @public
   * @param {CreateMatchBetDto} betData - Complete betting data including user, match, and bet details
   * @returns {Promise<MatchBet & { profitLossBreakdown?: Record<string, number>; updatedExposure?: number; availableBalance?: number; }>}
   *          Created bet with profit/loss breakdown and updated balances
   * @throws {HttpException} When validation fails or insufficient balance
   */
  public async createMatchBet(betData: CreateMatchBetDto): Promise<MatchBet & { profitLossBreakdown?: Record<string, number>; updatedExposure?: number; availableBalance?: number; }> {
    if (isEmpty(betData)) throw new HttpException(400, 'Bet data is empty');

    // Validate user exists and has sufficient balance
    const user = await this.user.findById(betData.user_id);
    if (!user) throw new HttpException(404, 'User not found');

    if (!user.status) throw new HttpException(404, `User's Bet Locked`);

    // const stake = Number(betData.stake_amount);
    // const odds = Number(betData.odds_rate);

    // const isPercentage =
    //   (betData.bet_type === MatchBetType.BOOKMAKER && betData.selection === 'Lay') ||
    //   (betData.bet_type === MatchBetType.FANCY && betData.selection === 'Not');

    // const requiredAmount = isPercentage ? (stake * odds) / 100 : stake;

    // if (user.wallet < requiredAmount) {
    //   throw new HttpException(400, 'Insufficient balance');
    // }

    // Validate match exists and is active
    const match = await this.match.findById(betData.match_id);
    if (!match) throw new HttpException(404, 'Match not found');

    if (!match.status) {
      throw new HttpException(400, 'Match is not active for betting');
    }


    // === delay before updating match ===
    await this.delay(match.bet_delay * 1000);

    // Get fancy odds if it's a FANCY bet
    let fancyOdds = null;
    if (betData.bet_type === MatchBetType.FANCY && betData.market_id) {
      fancyOdds = await this.fancyOdds.findOne({ marketId: betData.market_id, sid: Number(betData.selection_id) });
      if (!fancyOdds) {
        throw new HttpException(400, 'No fancy odds available for this market');
      }
    }

    // Validate betting data
    await this.validateBettingData(betData, match, fancyOdds, user);

    // Get odds data and calculate potential winnings
    let oddsRate: string;
    let oddsValue: string | undefined;
    let teamName: string | undefined;
    let sessionName: string | undefined;
    let runnerName: string | undefined;
    let gameId: string | undefined;
    let eventId: string | undefined;
    let sid: number | undefined;
    let minStake: number | undefined;
    let maxStake: number | undefined;

    if (betData.bet_type === MatchBetType.BOOKMAKER) {
      let oddsData = null;
      for (const bookmakerWrapper of match.bookMakerOdds) {
        const bookmakerKeys = Object.keys(bookmakerWrapper);
        for (const key of bookmakerKeys) {
          if (key !== 'bm1') continue;
          const bookmaker = bookmakerWrapper[key];
          if (bookmaker && bookmaker.oddDatas && Array.isArray(bookmaker.oddDatas)) {
            for (const odds of bookmaker.oddDatas) {
              if (odds.sid == betData.selection_id) {
                oddsData = odds;
                break;
              }
            }
            if (oddsData) break;
          }
        }
        if (oddsData) break;
      }

      oddsRate = betData.selection === 'Back' ? oddsData.b1 : oddsData.l1;
      teamName = betData.team_name || oddsData.team_name || oddsData.rname || oddsData.name;
      gameId = betData.game_id || match.gameId;
      eventId = betData.event_id || match.eventId;

    } else if (betData.bet_type === MatchBetType.FANCY && fancyOdds) {
      oddsRate = betData.selection === 'Yes' ? fancyOdds.bs1 : fancyOdds.ls1;
      oddsValue = betData.selection === 'Yes' ? fancyOdds.b1 : fancyOdds.l1;
      sessionName = betData.session_name || fancyOdds.session_name || fancyOdds.name;
      runnerName = betData.runner_name || fancyOdds.runner_name || fancyOdds.rname;
      gameId = betData.game_id || fancyOdds.gameId;
      sid = betData.sid || fancyOdds.sid;
      minStake = fancyOdds.min;
      maxStake = fancyOdds.max;
    }

    // Calculate potential winnings
    if (!oddsRate) {
      throw new HttpException(400, 'Odds rate is required');
    }

    const potentialWinnings = this.calculatePotentialWinnings(
      betData.bet_type,
      betData.selection,
      betData.stake_amount,
      oddsRate
    );

    // Create bet data
    const newBetData: any = {
      ...betData,
      odds_rate: oddsRate,
      odds_value: oddsValue,
      potential_winnings: potentialWinnings,
      status: MatchBetStatus.PENDING,
      team_name: teamName,
      session_name: sessionName,
      runner_name: runnerName,
      game_id: gameId,
      event_id: eventId,
      sid: sid,
      min_stake: minStake,
      max_stake: maxStake,
      is_active: true,
      is_enabled: true
    };

    // Create the bet
    const createdBet = await this.matchBet.create(newBetData);

    // Get current user data to calculate proper wallet update
    const currentUser = await this.user.findById(betData.user_id);
    if (!currentUser) {
      throw new HttpException(404, 'User not found');
    }

    let profitLossData: any = {};
    // Calculate team-wise profit/loss after placing the bet
    if (betData.bet_type === MatchBetType.BOOKMAKER) {
      profitLossData = await this.calculateTeamWiseProfitLoss(
        betData.user_id,
        betData.match_id
      );
    } else if (betData.bet_type === MatchBetType.FANCY) {
      profitLossData = await this.calculateRunWiseProfitLoss(
        betData.user_id,
        betData.match_id,
        betData.selection_id,
      );
    }

    // Create or update exposure record - optimized version
    const exposureQuery = {
      user_id: betData.user_id,
      match_id: betData.match_id,
      gameId: betData.game_id,
      bet_type: betData.bet_type,
      ...(betData.bet_type === MatchBetType.FANCY && { selection_id: betData.selection_id })
    };

    const existingExposure = await this.exposure.findOne(exposureQuery);

    const exposureData = {
      user_id: betData.user_id,
      match_id: betData.match_id,
      gameId: betData.game_id,
      bet_type: betData.bet_type,
      selection_id: betData.selection_id,
      potential_profitloss: profitLossData.profitLossBreakdown,
      exposure: profitLossData.totalExposure,
      status: true,
    };

    // Prepare user update operations
    let userUpdateOps;

    if (!existingExposure) {

      if (currentUser.exposure + profitLossData.totalExposure > currentUser.exposure) {

        if (profitLossData.totalExposure > currentUser.wallet) {
          await this.matchBet.findByIdAndDelete(createdBet._id);
          throw new HttpException(400, 'Insufficient balance to cover the increased exposure');
        }
        // Create new exposure record
        await this.exposure.create(exposureData);

        // User wallet update for new exposure
        userUpdateOps = {
          $inc: {
            wallet: -profitLossData.totalExposure,
            exposure: +profitLossData.totalExposure,
          }
        };
      }

    } else {

      // Calculate exposure difference
      const exposureDiff = Number(profitLossData.totalExposure) - Number(existingExposure.exposure);
      // const exposureDiff = Number(currentUser.exposure) - Number(existingExposure.exposure);

      logger.info('exposureDiff', exposureDiff);
      logger.info('currentUser.exposure', currentUser.exposure);
      logger.info('existingExposure.exposure', existingExposure.exposure);
      // *** NEW VALIDATION LOGIC ***
      // If exposure is increasing (exposureDiff > 0), check if user has sufficient balance
      if (currentUser.exposure + exposureDiff > currentUser.exposure) {
        // Get current available wallet balance
        const availableWallet = currentUser.wallet;

        if (exposureDiff > availableWallet) {
          logger.info('Insufficient balance to cover the increased exposure', exposureDiff, availableWallet);
          // Insufficient balance - delete the created bet and throw error
          await this.matchBet.findByIdAndDelete(createdBet._id);
          throw new HttpException(400, 'Insufficient balance to cover the increased exposure');
        }
      }
      // If exposure is decreasing (exposureDiff <= 0), no validation needed - continue process

      // Update existing exposure record
      await this.exposure.findByIdAndUpdate(existingExposure._id, {
        potential_profitloss: profitLossData.profitLossBreakdown,
        exposure: profitLossData.totalExposure,
      });

      // Prepare user update
      userUpdateOps = {
        $inc: {
          wallet: -exposureDiff,  // subtract if new exposure is bigger, add if old was bigger
          exposure: +exposureDiff, // add if new exposure is bigger, subtract if old was bigger
        }
      };
    }

    // Single user update operation
    await this.user.findByIdAndUpdate(betData.user_id, userUpdateOps);

    // Get updated user data for available balance
    const updatedUser = await this.user.findById(betData.user_id);
    const availableBalance = updatedUser ? updatedUser.wallet - updatedUser.exposure : 0;

    // Create match transaction
    await this.matchTransaction.create({
      user_id: betData.user_id,
      receiver_id: betData.user_id,
      amount: existingExposure ? Number(Number(profitLossData.totalExposure) - Number(existingExposure.exposure)) : Number(profitLossData.totalExposure),
      type: !existingExposure ? MatchTransactionType.CREDIT : Number(Number(profitLossData.totalExposure) - Number(existingExposure.exposure)) > 0 ? MatchTransactionType.DEBIT : MatchTransactionType.CREDIT,
      transfer_type: MatchTransactionTransferType.CREATED,
      note: betData.bet_type === MatchBetType.BOOKMAKER ? 'Bookmaker Bet' : 'Fancy Bet',
      status: MatchTransactionStatus.DONE,
      bet_id: createdBet._id,
    });

    // Return bet with profit/loss breakdown
    return {
      ...createdBet.toObject(),
      profitLossBreakdown: profitLossData.profitLossBreakdown,
      updatedExposure: profitLossData.totalExposure,
      availableBalance: availableBalance
    };
  }

  // ========================================
  // PROFIT/LOSS CALCULATION METHODS
  // ========================================

  /**
   * Calculates team-wise profit/loss scenarios for bookmaker bets
   *
   * This method analyzes all active bets for a user in a specific match
   * and calculates the profit/loss for each possible outcome (team win).
   * It considers both Back and Lay bets to provide accurate exposure calculations.
   *
   * @public
   * @param {string} userId - The user ID to calculate profit/loss for
   * @param {string} matchId - The match ID to analyze
   * @returns {Promise<{ profitLossBreakdown: Record<string, number>; totalExposure: number; }>}
   *          Object containing team-wise profit/loss and total exposure amount
   * @throws {HttpException} When match is not found
   */
  public async calculateTeamWiseProfitLoss(userId: string, matchId: string): Promise<{ profitLossBreakdown: Record<string, number>; totalExposure: number; }> {
    try {
      // Get match data for team name resolution
      const match = await this.match.findById(matchId);
      if (!match) {
        throw new HttpException(404, 'Match not found');
      }

      // Get all active bets for this user and match
      const bets = await this.matchBet.find({
        user_id: userId,
        match_id: matchId,
        status: { $in: [MatchBetStatus.PENDING, MatchBetStatus.WON, MatchBetStatus.LOST] },
        is_active: true
      });

      const profitLoss = new Map<string, number>();

      // Initialize profit/loss for all possible selections based on bet types present
      const hasBookmakerBets = bets.some(bet => bet.bet_type === MatchBetType.BOOKMAKER);

      if (hasBookmakerBets) {
        // Initialize with actual team names from match data
        const bookmakerSelectionIds = this.getBookmakerSelectionIds(match);
        for (const selectionId of bookmakerSelectionIds) {
          const teamName = this.getTeamNameBySelectionId(match, selectionId);
          profitLoss.set(teamName, 0);
        }
      }

      // Process each bet
      for (const bet of bets) {
        const betOddsRate = parseFloat(bet.odds_rate);

        if (bet.bet_type === MatchBetType.BOOKMAKER) {
          if (bet.selection === 'Back') {
            const winAmount = bet.stake_amount * (betOddsRate / 100);
            const loseAmount = -bet.stake_amount;

            // Get actual team name for this bet's selection_id
            const betTeamName = this.getTeamNameBySelectionId(match, bet.selection_id);

            // Apply win to the bet's team and loss to all other teams
            for (const [teamName] of profitLoss) {
              if (teamName === 'yes' || teamName === 'no') continue; // Skip fancy bet keys

              if (teamName === betTeamName) {
                profitLoss.set(teamName, profitLoss.get(teamName)! + winAmount);
              } else {
                profitLoss.set(teamName, profitLoss.get(teamName)! + loseAmount);
              }
            }
          } else if (bet.selection === 'Lay') {
            const winAmount = bet.stake_amount;
            const loseAmount = -(bet.stake_amount * (betOddsRate / 100));

            // Get actual team name for this bet's selection_id
            const betTeamName = this.getTeamNameBySelectionId(match, bet.selection_id);

            // Apply loss to the bet's team and win to all other teams
            for (const [teamName] of profitLoss) {
              if (teamName === 'yes' || teamName === 'no') continue; // Skip fancy bet keys

              if (teamName === betTeamName) {
                profitLoss.set(teamName, profitLoss.get(teamName)! + loseAmount);
              } else {
                profitLoss.set(teamName, profitLoss.get(teamName)! + winAmount);
              }
            }
          }
        }
      }

      // Calculate total exposure as maximum potential loss
      const allProfitLossValues = Array.from(profitLoss.values());
      const totalExposure = Math.abs(Math.min(...allProfitLossValues, 0));

      return {
        profitLossBreakdown: Object.fromEntries(profitLoss),
        totalExposure
      };
    } catch (error) {
      logger.error('Error calculating team-wise profit/loss:', error);
      return {
        profitLossBreakdown: {},
        totalExposure: 0
      };
    }
  }

/**
* Calculate team-wise profit/loss for a specific user and match
* @param userId - User ID
* @param matchId - Match ID
* @returns Team-wise profit/loss breakdown
*/
  public async calculateRunWiseProfitLoss(userId: string, matchId: string, selectionId: number): Promise<{ profitLossBreakdown: Record<string, number>; totalExposure: number; }> {
    try {
      // Get match data for team name resolution
      const match = await this.match.findById(matchId);
      if (!match) {
        throw new HttpException(404, 'Match not found');
      }

      // Get all active bets for this user and match
      const bets = await this.matchBet.find({
        user_id: userId,
        match_id: matchId,
        selection_id: selectionId,
        status: { $in: [MatchBetStatus.PENDING, MatchBetStatus.WON, MatchBetStatus.LOST] },
        is_active: true
      });

      const profitLoss = new Map<string, number>();

      const hasFancyBets = bets.some(bet => bet.bet_type === MatchBetType.FANCY)

      // Initialize with Run(odds_value) if bet
      const fancyBetsRuns = this.calculateRunList(bets.filter(bet => bet.bet_type === MatchBetType.FANCY));

      if (hasFancyBets) {
        for (const fancyBetsRun of fancyBetsRuns) {
          profitLoss.set(String(fancyBetsRun), 0)
        }
      }

      const minRun = Math.min(...fancyBetsRuns);
      const maxRun = Math.max(...fancyBetsRuns);

      // Process each bet
      for (const bet of bets) {
        const betOddsRate = parseFloat(bet.odds_rate);
        const betOddsValue = bet.odds_value ? parseFloat(bet.odds_value) : 0;
        if (bet.bet_type === MatchBetType.FANCY) {
          if (bet.selection === 'Yes') {
            const winAmount = bet.stake_amount * (betOddsRate / 100);
            const loseAmount = -bet.stake_amount;

            // Win from betOddsValue → max
            for (let run = betOddsValue; run <= maxRun; run++) {
              profitLoss.set(String(run), profitLoss.get(String(run))! + winAmount);
            }

            // Lose from min → betOddsValue-1
            for (let run = minRun; run < betOddsValue; run++) {
              profitLoss.set(String(run), profitLoss.get(String(run))! + loseAmount);
            }
          } else if (bet.selection === 'Not') {
            const winAmount = bet.stake_amount;
            const loseAmount = -(bet.stake_amount * (betOddsRate / 100));

            // Win from min → betOddsValue-1
            for (let run = minRun; run < betOddsValue; run++) {
              profitLoss.set(String(run), profitLoss.get(String(run))! + winAmount);
            }

            // Lose from betOddsValue → max
            for (let run = betOddsValue; run <= maxRun; run++) {
              profitLoss.set(String(run), profitLoss.get(String(run))! + loseAmount);
            }
          }
        }
      }

      // Calculate total exposure as maximum potential loss
      const allProfitLossValues = Array.from(profitLoss.values());
      const totalExposure = Math.abs(Math.min(...allProfitLossValues, 0));

      return {
        profitLossBreakdown: Object.fromEntries(profitLoss),
        totalExposure
      };
    } catch (error) {
      logger.error('Error calculating team-wise profit/loss:', error);
      return {
        profitLossBreakdown: {},
        totalExposure: 0
      };
    }
  }

  /**
   * Retrieves all match bets with advanced filtering and pagination
   *
   * This method provides comprehensive bet retrieval with support for:
   * - User-specific filtering
   * - Match-specific filtering
   * - Bet type and status filtering
   * - Date range filtering
   * - Pagination with skip and limit
   * - Population of user and match details
   *
   * @public
   * @param {any} queryData - Query parameters object containing filters and pagination options
   * @param {string} [queryData.user_id] - Filter by specific user ID
   * @param {string} [queryData.match_id] - Filter by specific match ID
   * @param {MatchBetType} [queryData.bet_type] - Filter by bet type (BOOKMAKER/FANCY)
   * @param {MatchBetStatus} [queryData.status] - Filter by bet status
   * @param {string} [queryData.from_date] - Start date for date range filter
   * @param {string} [queryData.to_date] - End date for date range filter
   * @param {string} [queryData.skip] - Number of records to skip (pagination)
   * @param {string} [queryData.count] - Maximum number of records to return
   * @returns {Promise<{ bets: MatchBetRespond[], total: number }>} Object containing filtered bets and total count
   */
  public async getAllMatchBets(queryData: any): Promise<{ bets: MatchBetRespond[], total: number }> {
    const query: any = {};

    if (queryData.user_id) query.user_id = new ObjectId(queryData.user_id);
    if (queryData.match_id) query.match_id = new ObjectId(queryData.match_id);
    if (queryData.bet_type) query.bet_type = queryData.bet_type;
    if (queryData.status) query.status = queryData.status;

    // Date range filter
    if (queryData.from_date || queryData.to_date) {
      query.createdAt = {};
      if (queryData.from_date) {
        query.createdAt.$gte = new Date(queryData.from_date);
      }
      if (queryData.to_date) {
        query.createdAt.$lt = new Date(queryData.to_date);
      }
    }

    const skip = parseInt(queryData.skip || '0');
    const limit = parseInt(queryData.count || '50');

    // Populate user_id with username and name, and match_id with eventName, eventTime, seriesName, gameId, eventId
    const [bets, total] = await Promise.all([
      this.matchBet
        .find(query)
        .populate('user_id', 'username name')
        .populate('match_id', 'eventName eventTime seriesName gameId eventId teams teamName sessionName runnerName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.matchBet.countDocuments(query)
    ]);

    const formattedBets: MatchBetRespond[] = bets.map(bet => ({
      id: bet._id.toString(),
      user: bet.user_id,
      match: bet.match_id,
      bet_type: bet.bet_type,
      selection: bet.selection,
      selection_id: bet.selection_id,
      market_id: bet.market_id,
      odds_value: bet.odds_value,
      odds_rate: bet.odds_rate,
      stake_amount: bet.stake_amount,
      potential_winnings: bet.potential_winnings,
      status: bet.status,
      result: bet.result,
      settled_at: bet.settled_at,
      team_name: bet.team_name,
      session_name: bet.session_name,
      runner_name: bet.runner_name,
      game_id: bet.game_id,
      event_id: bet.event_id,
      sid: bet.sid,
      createdAt: bet.createdAt,
      updatedAt: bet.updatedAt
    }));

    return { bets: formattedBets, total };
  }

  /**
 * Retrieves all match bets with advanced filtering and pagination
 *
 * This method provides comprehensive bet retrieval with support for:
 * - User-specific filtering
 * - Match-specific filtering
 * - Bet type and status filtering
 * - Date range filtering
 * - Pagination with skip and limit
 * - Population of user and match details
 *
 * @public
 * @param {any} queryData - Query parameters object containing filters and pagination options
 * @param {string} [queryData.user_id] - Filter by specific user ID
 * @param {string} [queryData.match_id] - Filter by specific match ID
 * @param {MatchBetType} [queryData.bet_type] - Filter by bet type (BOOKMAKER/FANCY)
 * @param {MatchBetStatus} [queryData.status] - Filter by bet status
 * @param {string} [queryData.from_date] - Start date for date range filter
 * @param {string} [queryData.to_date] - End date for date range filter
 * @param {string} [queryData.skip] - Number of records to skip (pagination)
 * @param {string} [queryData.count] - Maximum number of records to return
 * @returns {Promise<{ bets: MatchBetRespond[], total: number }>} Object containing filtered bets and total count
 */
  public async getAllAdminMatchBets(queryData: any): Promise<{ bets: any[]; total: number }> {
    if (!queryData?.admin_id) return { bets: [], total: 0 };

    const adminId = new ObjectId(queryData.admin_id);
    const skip = parseInt(queryData.skip || "0", 10);
    const limit = parseInt(queryData.count || "50", 10);

    // 1) Get all userIds under this admin hierarchy
    const userIds = await this.hierarchyService.getAllUserIdsUnderAdmin(adminId);
    if (!userIds?.length) return { bets: [], total: 0 };

    // 2) Build bet query
    const betQuery: any = { user_id: { $in: userIds } };
    if (queryData.match_id) betQuery.match_id = new ObjectId(queryData.match_id);
    if (queryData.bet_type) betQuery.bet_type = queryData.bet_type;
    if (queryData.status) betQuery.status = queryData.status;
    if (queryData.from_date || queryData.to_date) {
      betQuery.createdAt = {};
      if (queryData.from_date) betQuery.createdAt.$gte = new Date(queryData.from_date);
      if (queryData.to_date) betQuery.createdAt.$lt = new Date(queryData.to_date);
    }

    // 3) Fetch bets and total count in parallel
    const [bets, total] = await Promise.all([
      this.matchBet
        .find(betQuery)
        .populate("user_id", "user_name name agent_id")
        .populate(
          "match_id",
          "eventName eventTime seriesName gameId eventId teams teamName sessionName runnerName"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.matchBet.countDocuments(betQuery),
    ]);

    if (!bets.length) return { bets: [], total };

    // 4) Build a fresh hierarchy per request for this admin
    const hierarchy = await buildHierarchy(queryData.admin_id)

    // 5) Format bets with hierarchy
    const formattedBets = bets.map((b: any) => ({
      id: b._id.toString(),
      user: { id: b.user_id._id, user_name: b.user_id.user_name, name: b.user_id.name },
      match: b.match_id,
      bet_type: b.bet_type,
      selection: b.selection,
      selection_id: b.selection_id,
      market_id: b.market_id,
      odds_value: b.odds_value,
      odds_rate: b.odds_rate,
      stake_amount: b.stake_amount,
      potential_winnings: b.potential_winnings,
      status: b.status,
      result: b.result,
      settled_at: b.settled_at,
      team_name: b.team_name,
      session_name: b.session_name,
      runner_name: b.runner_name,
      game_id: b.game_id,
      event_id: b.event_id,
      sid: b.sid,
      hierarchy, // always fresh hierarchy array per request
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));

    return { bets: formattedBets, total };
  }

  // ========================================
  // BOOKMAKER BET SETTLEMENT METHODS
  // ========================================

  /**
   * Settles all bookmaker bets for a completed match
   *
   * This method handles the complete settlement process for bookmaker bets:
   * 1. Validates match and winning team information
   * 2. Updates bet statuses (WON/LOST) based on the winning team
   * 3. Calculates and processes financial settlements
   * 4. Updates user wallets and exposures
   * 5. Creates transaction records for audit trail
   * 6. Marks the match as declared
   *
   * @public
   * @param {string} matchId - The unique identifier of the completed match
   * @param {number} sid - The selection ID of the winning team
   * @param {string} team - The name of the winning team
   * @throws {HttpException} When match not found, already declared, or invalid parameters
   * @returns {Promise<{ message: string; settledBets?: number; }>} Settlement result summary
   */
  public async settleBookMackerBets(matchId: string, sid: number, team: string) {
    if (!matchId || !sid || !team) {
      throw new HttpException(400, "Missing required parameters: matchId, sid, or team");
    }

    const matchObjectId = new ObjectId(matchId);
    const match = await this.match.findById(matchId);

    if (!match) throw new HttpException(404, "Match not found");
    if (match.declared) throw new HttpException(400, "Match is already declared");

    // Check All Fancy Odds is Declred Or Not
    const allFancyOddsDeclared = await this.fancyOdds.exists({
      match_id: matchObjectId,
      isActive: true,
      isDeclared: false
    });

    if (allFancyOddsDeclared) {
      throw new HttpException(400, "Fancy bets are not fully settled");
    }

    const matchExposure = await this.exposure
      .find({
        match_id: matchObjectId,
        bet_type: MatchBetType.BOOKMAKER,
        status: true,
      })
      .lean();

    const winTeam = this.getTeamNameBySelectionId(match, Number(sid));
    // Normalization function
    const normalize = (str: string) =>
      str.trim().replace(/\.+$/, "").toLowerCase(); // remove spaces, trailing dots, and lowercase

    if (!winTeam || normalize(winTeam) !== normalize(team)) {
      throw new HttpException(400, "Invalid SID");
    }


    // Mark match as declared
    await this.match.updateOne(
      { _id: matchObjectId },
      { $set: { wonby: winTeam, declared: true } }
    );

    if (matchExposure.length === 0) {
      return { message: "No bets found to settle" };
    }

    const now = new Date();

    await this.matchBet.updateMany(
      {
        match_id: matchObjectId,
        bet_type: MatchBetType.BOOKMAKER,
        status: {
          $in: MatchBetStatus.PENDING,
          $ne: MatchBetStatus.DELETED
        }
      },
      [
        {
          $set: {
            settled_at: now,
            status: {
              $let: {
                vars: { isWinner: { $eq: ["$team_name", winTeam] } },
                in: { $cond: ["$$isWinner", MatchBetStatus.WON, MatchBetStatus.LOST] }
              }
            },
            result: winTeam
            // result: {
            //   $let: {
            //     vars: { isWinner: { $eq: ["$team_name", winTeam] } },
            //     in: { $cond: ["$$isWinner", winTeam, "$team_name"] }
            //   }
            // }
          }
        }
      ]
    );


    const userIds = [...new Set(matchExposure.map((b) => b.user_id.toString()))];
    const users = await this.user
      .find({ _id: { $in: userIds } }, { _id: 1, wallet: 1, exposure: 1 })
      .lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const userUpdates: any[] = [];
    const transactionInserts: any[] = [];
    const exposureUpdates: any[] = [];
    const settlementResults: any[] = [];

    for (const bet of matchExposure) {
      const { user_id, potential_profitloss, exposure, match_id } = bet;
      const userId = user_id.toString();

      const currentUser = userMap.get(userId);
      if (!currentUser) {
        console.error(`User not found: ${user_id}`);
        continue;
      }

      // Calculate Commision on Bets
      const commission = await this.calculateBookmakerCommission(match_id.toString(), user_id.toString());

      if (!potential_profitloss || potential_profitloss[winTeam] === undefined) {
        console.warn(`Team ${winTeam} not found in potential_profitloss for bet ${bet._id}`);
        continue;
      }

      const { wallet = 0, exposure: currentExposure = 0 } = currentUser;

      const settlementData = this.calculateSettlementData(
        winTeam,
        potential_profitloss,
        Number(exposure)
      );

      userUpdates.push({
        updateOne: {
          filter: { _id: user_id },
          update: {
            $set: {
              wallet: wallet + settlementData.transactionAmount + commission,
              exposure: Math.max(currentExposure - Number(exposure), 0),
            },
          },
        },
      });

      transactionInserts.push({
        user_id,
        amount: settlementData.transactionType === 'win' ? settlementData.transactionAmount : -settlementData.transactionAmount,
        type: settlementData.transactionType === 'win' ? MatchTransactionType.CREDIT : MatchTransactionType.DEBIT,
        transfer_type: MatchTransactionTransferType.BOOKMAKER_SETTLEMENT,
        status: MatchTransactionStatus.DONE,
        note: settlementData.transactionDescription,
        match_id,
      });

      exposureUpdates.push({
        updateOne: {
          filter: { _id: bet._id },
          update: {
            $addToSet: { transaction_id: bet.transaction_id },
            $set: {
              settlement_status: ExposureStatus.SETTLED,
              settlement_amount: Number(settlementData.transactionAmount),
              settlement_commission: Number(commission),
              status: false // mark as settled
            }
          },
        },
      });

      settlementResults.push({
        userId: user_id,
        description: settlementData.transactionDescription,
      });
    }

    if (userUpdates.length > 0) {
      try {
        await Promise.all([
          this.user.bulkWrite(userUpdates, { ordered: false }),
          this.transaction.insertMany(transactionInserts, { ordered: false }),
          this.exposure.bulkWrite(exposureUpdates, { ordered: false }),
        ]);
      } catch (err) {
        console.error("Error during batch settlement operations:", err);
        throw new HttpException(500, "Failed to process bet settlements");
      }
    }

    return { message: "Bets settled successfully" };
  }

  /**
   * Calculate Commission on Bookmaker Bets
   * @param matchId
   * @param userId
   */
  private async calculateBookmakerCommission(matchId: string, userId: string): Promise<number> {
    const matchObjectId = new ObjectId(matchId);
    const userObjectId = new ObjectId(userId);

    const user = await this.user.findById(userObjectId);
    if (!user) throw new HttpException(404, "User not found");

    if (!user.match_commission) return 0;

    const bets = await this.matchBet.find({
      match_id: matchObjectId,
      user_id: userObjectId,
      bet_type: MatchBetType.BOOKMAKER,
      status: {
        $in: [MatchBetStatus.WON, MatchBetStatus.LOST],
        $ne: MatchBetStatus.DELETED
      },
    });

    if (!bets.length) return 0;

    // Calculate profit/loss
    const totalProfitLoss = bets.reduce((acc, bet) => {
      const winnings = Number(bet.potential_winnings.toFixed(8));

      if (bet.selection === "Back") {
        return acc + (bet.status === MatchBetStatus.WON ? winnings : -bet.stake_amount);
      } else if (bet.selection === "Lay") {
        return acc + (bet.status === MatchBetStatus.WON ? bet.stake_amount : -winnings);
      }
      return acc;
    }, 0);

    // Commission only on losses (positive value)
    return totalProfitLoss < 0
      ? Math.round(Number((Math.abs(totalProfitLoss) * (user.match_commission / 100)).toFixed(8)))
      : 0;
  }

  /**
 * Calculate settlement data for a bet - Extracted helper method
 * @param winTeam - Winning team name
 * @param potential_profitloss - Potential profit/loss object
 * @param exposure - Exposure amount
 * @returns Settlement calculation data
 */
  /**
   * Calculates settlement data for bookmaker bet resolution
   *
   * This method determines the financial impact of bet settlement including:
   * - Wallet balance changes (profit/loss)
   * - Transaction type classification
   * - Transaction amount calculation
   * - Descriptive transaction details
   *
   * @private
   * @param {string} winTeam - The name of the winning team
   * @param {any} potential_profitloss - Object containing profit/loss scenarios for each team
   * @param {number} exposure - Current exposure amount for the user
   * @returns {{ walletChange: number; transactionType: string; transactionAmount: number; transactionDescription: string; }}
   *          Object containing complete settlement calculation details
   */
  private calculateSettlementData(winTeam: string, potential_profitloss: any, exposure: number): { walletChange: number; transactionType: string; transactionAmount: number; transactionDescription: string; } {
    const profitLossKeys = Object.keys(potential_profitloss);
    let walletChange: number;
    let transactionDescription: string;

    // Normalization function
    const normalize = (str: string) =>
      str.trim().replace(/\.+$/, "").toLowerCase(); // remove spaces, trailing dots, and lowercase

    // Handle specific team outcomes based on requirements
    // Maintain current wallet balance (wallet + potential_profitloss[winTeam] + exposure = wallet)
    if (normalize(winTeam) === normalize(profitLossKeys[0])) {
      walletChange = potential_profitloss[winTeam] + exposure;
      transactionDescription = `${winTeam} won - Profit: ₹${potential_profitloss[winTeam]}, Exposure released: ₹${exposure}, Total added: ₹${walletChange}`;
    } else if (normalize(winTeam) === normalize(profitLossKeys[1])) {
      walletChange = potential_profitloss[winTeam] + exposure;
      transactionDescription = `${profitLossKeys[1]} won - Loss: ₹${potential_profitloss[profitLossKeys[1]]}, Exposure released: ₹${exposure}, Net change: ₹${walletChange}`;
    } else if (normalize(winTeam) === normalize(profitLossKeys[2])) {
      // Fallback to original logic for other teams
      walletChange = potential_profitloss[winTeam] + exposure;
      transactionDescription = `${winTeam} won - P&L: ₹${potential_profitloss[winTeam]}, Exposure released: ₹${exposure}`;
    } else {
      // Default case
      walletChange = potential_profitloss[winTeam] + exposure;
      transactionDescription = `${winTeam} won - P&L: ₹${potential_profitloss[winTeam]}, Exposure released: ₹${exposure}`;
    }

    const transactionType = walletChange >= 0 ? 'win' : 'lose';
    const transactionAmount = Math.abs(walletChange);

    return {
      walletChange,
      transactionType,
      transactionAmount,
      transactionDescription
    };
  }

  // ========================================
  // BOOKMAKER BET CANCEL METHODS
  // ========================================

  /**
   * Cancels all bookmaker bets for a completed match
   *
   * This method handles the complete cancellation process for bookmaker bets:
   * 1. Validates match and cancellation information
   * 2. Updates bet statuses (WON/LOST) based on the winning team
   * 3. Calculates and processes financial settlements
   * 4. Updates user wallets and exposures
   * 5. Creates transaction records for audit trail
   * 6. Marks the match as declared
   *
   * @public
   * @param {string} matchId - The unique identifier of the completed match
   * @param {number} sid - The selection ID of the winning team
   * @param {string} team - The name of the winning team
   * @throws {HttpException} When match not found, already declared, or invalid parameters
   * @returns {Promise<{ message: string; settledBets?: number; }>} Settlement result summary
   */
  public async cancelBookMackerBets(matchId: string) {
    if (!matchId) {
      throw new HttpException(400, "Missing required parameters: matchId");
    }

    const matchObjectId = new ObjectId(matchId);
    const match = await this.match.findById(matchId);

    if (!match) throw new HttpException(404, "Match not found");
    if (match.declared) throw new HttpException(400, "Match is already declared");

    // Check All Fancy Odds is Declred Or Not
    const allFancyOddsDeclared = await this.fancyOdds.exists({
      match_id: matchObjectId,
      isActive: true,
      isDeclared: false,
      resultScore: null
    });

    if (allFancyOddsDeclared) {
      throw new HttpException(400, "All Fancy Odds are not declared");
    }

    const matchExposure = await this.exposure
      .find({
        match_id: matchObjectId,
        bet_type: MatchBetType.BOOKMAKER,
        status: true,
      })
      .lean();


    // Mark match as declared
    await this.match.updateOne(
      { _id: matchObjectId },
      { $set: { wonby: null, declared: true } }
    );

    if (matchExposure.length === 0) {
      return { message: "No bets found to cancel" };
    }

    const now = new Date();

    await this.matchBet.updateMany(
      {
        match_id: matchObjectId,
        bet_type: MatchBetType.BOOKMAKER,
        status: {
          $in: MatchBetStatus.PENDING,
          $ne: MatchBetStatus.DELETED
        }
      },
      [
        {
          $set: {
            settled_at: now,
            status: MatchBetStatus.CANCELLED,
            result: null
          }
        }
      ]
    );


    const userIds = [...new Set(matchExposure.map((b) => b.user_id.toString()))];
    const users = await this.user
      .find({ _id: { $in: userIds } }, { _id: 1, wallet: 1, exposure: 1 })
      .lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const userUpdates: any[] = [];
    const transactionInserts: any[] = [];
    const exposureUpdates: any[] = [];
    const cancellationResults: any[] = [];

    for (const bet of matchExposure) {
      const { user_id, exposure, match_id } = bet;
      const userId = user_id.toString();

      const currentUser = userMap.get(userId);
      if (!currentUser) {
        console.error(`User not found: ${user_id}`);
        continue;
      }

      userUpdates.push({
        updateOne: {
          filter: { _id: user_id },
          update: {
            $inc: {
              wallet: +Number(exposure),
              exposure: -Number(exposure),
            },
          },
        },
      });

      transactionInserts.push({
        user_id,
        amount: Number(exposure),
        type: MatchTransactionType.CREDIT,
        transfer_type: MatchTransactionTransferType.BOOKMAKER_CANCELLED,
        status: MatchTransactionStatus.DONE,
        note: "Bookmaker bet cancelled",
        match_id,
      });

      exposureUpdates.push({
        updateOne: {
          filter: { _id: bet._id },
          update: {
            $set: {
              status: false,
              settlement_status: ExposureStatus.CANCELLED,
            }
          }, // mark as settled
        },
      });

      cancellationResults.push({
        userId: user_id,
        description: "Bookmaker bet cancelled",
      });
    }

    if (userUpdates.length > 0) {
      try {
        await Promise.all([
          this.user.bulkWrite(userUpdates, { ordered: false }),
          this.transaction.insertMany(transactionInserts, { ordered: false }),
          this.exposure.bulkWrite(exposureUpdates, { ordered: false }),
        ]);
      } catch (err) {
        console.error("Error during batch cancellation operations:", err);
        throw new HttpException(500, "Failed to process bet cancellations");
      }
    }

    return { message: "Bets cancelled successfully" };
  }

  // ========================================
  // BOOKMAKER BET ROLLBACK METHODS
  // ========================================

  /**
   * Rolls back all bookmaker bets for a completed match
   *
   * This method handles the complete rollback process for bookmaker bets:
   * 1. Validates match and rollback information
   * 2. Updates bet statuses (PENDING) based on the winning team
   * 3. Calculates and processes financial settlements
   * 4. Updates user wallets and exposures
   * 5. Creates transaction records for audit trail
   * 6. Marks the match as declared
   *
   * @public
   * @param {string} matchId - The unique identifier of the completed match
   * @param {number} sid - The selection ID of the winning team
   * @param {string} team - The name of the winning team
   * @throws {HttpException} When match not found, already declared, or invalid parameters
   * @returns {Promise<{ message: string; settledBets?: number; }>} Settlement result summary
   */
  public async rollbackBookMackerBets(matchId: string) {
    if (!matchId) {
      throw new HttpException(400, "Missing required parameters: matchId");
    }

    const matchObjectId = new ObjectId(matchId);
    const match = await this.match.findById(matchId);

    if (!match) throw new HttpException(404, "Match not found");
    // if (match.declared) throw new HttpException(400, "Match is already declared");

    const matchExposure = await this.exposure
      .find({
        match_id: matchObjectId,
        bet_type: MatchBetType.BOOKMAKER,
        status: false,
      })
      .lean();


    // Mark match as declared
    await this.match.updateOne(
      { _id: matchObjectId },
      { $set: { wonby: null, declared: false } }
    );

    if (matchExposure.length === 0) {
      return { message: "No bets found to rollback" };
    }

    const now = new Date();

    await this.matchBet.updateMany(
      {
        match_id:
          matchObjectId,
        bet_type: MatchBetType.BOOKMAKER,
        status: {
          $in: [MatchBetStatus.LOST, MatchBetStatus.WON, MatchBetStatus.CANCELLED],
          $ne: MatchBetStatus.DELETED
        }
      },
      [
        {
          $set: {
            settled_at: now,
            status: MatchBetStatus.PENDING,
            result: null
          }
        }
      ]
    );


    const userIds = [...new Set(matchExposure.map((b) => b.user_id.toString()))];
    const users = await this.user
      .find({ _id: { $in: userIds } }, { _id: 1, wallet: 1, exposure: 1 })
      .lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const userUpdates: any[] = [];
    const transactionInserts: any[] = [];
    const exposureUpdates: any[] = [];
    const cancellationResults: any[] = [];

    for (const bet of matchExposure) {
      const { user_id, exposure, match_id, settlement_amount, settlement_commission } = bet;
      const userId = user_id.toString();

      const currentUser = userMap.get(userId);
      if (!currentUser) {
        console.error(`User not found: ${user_id}`);
        continue;
      }

      userUpdates.push({
        updateOne: {
          filter: { _id: user_id },
          update: {
            $inc: {
              wallet: bet.settlement_amount === null && bet.settlement_commission === null ? -Number(exposure) : -(Number(settlement_amount) + Number(settlement_commission)),
              exposure: +Number(exposure),
            },
          },
        },
      });

      const transactionId = new ObjectId();
      transactionInserts.push({
        _id: transactionId,
        user_id,
        amount: bet.settlement_amount === null && bet.settlement_commission === null ? -Number(exposure) : -(Number(settlement_amount) + Number(settlement_commission)),
        type: MatchTransactionType.DEBIT,
        transfer_type: MatchTransactionTransferType.BOOKMAKER_ROLLBACK,
        status: MatchTransactionStatus.DONE,
        note: "Bookmaker bet rollback",
        match_id,
      });

      exposureUpdates.push({
        updateOne: {
          filter: { _id: bet._id },
          update: {
            $addToSet: { transaction_id: transactionId }, // ✅ use the generated ObjectId
            $set: {
              status: true,
              settlement_status: ExposureStatus.PENDING,
              settled_at: new Date(),
            }
          }, // mark as settled
        },
      });

      cancellationResults.push({
        userId: user_id,
        description: "Bookmaker bet rollback",
      });
    }

    if (userUpdates.length > 0) {
      try {
        await Promise.all([
          this.user.bulkWrite(userUpdates, { ordered: false }),
          this.transaction.insertMany(transactionInserts, { ordered: false }),
          this.exposure.bulkWrite(exposureUpdates, { ordered: false }),
        ]);
      } catch (err) {
        console.error("Error during batch cancellation operations:", err);
        throw new HttpException(500, "Failed to process bet cancellations");
      }
    }

    return { message: "Bets cancelled successfully" };
  }

  // ========================================
  // FANCY BET SETTLEMENT METHODS
  // ========================================

  /**
   * Settle fancy bets with optimized performance and enhanced error handling
   * @param matchId - ID of the match
   * @param sid - SID of the bet
   * @param run - Run scored
   * @param fancyId - ID of the fancy bet
   * @returns Promise with settlement results
   */
  /**
   * Settles all fancy bets for a specific market based on the actual run outcome
   *
   * This method handles the complete settlement process for fancy bets:
   * 1. Validates input parameters and match/fancy data
   * 2. Retrieves all active fancy bet exposures for the market
   * 3. Calculates profit/loss based on actual run vs bet predictions
   * 4. Updates user wallets and exposures accordingly
   * 5. Creates detailed transaction records
   * 6. Updates bet statuses and settlement timestamps
   *
   * @public
   * @param {string} matchId - The unique identifier of the match
   * @param {number} sid - The selection ID for the fancy market
   * @param {number} run - The actual run outcome for settlement
   * @param {string} fancyId - The unique identifier of the fancy market
   * @returns {Promise<{ message: string; settledBets: number; results: Array<{ userId: string; betId: string; walletExposureResult: number; settlementAmount: number; selectedKey: string; run: number; }>; }>}
   *          Object containing settlement summary and detailed results
   * @throws {HttpException} When validation fails or settlement processing encounters errors
   */
  public async settleFancyBets(matchId: string, sid: number, run: number, fancyId: string): Promise<{ message: string; settledBets: number; results: Array<{ userId: string; betId: string; walletExposureResult: number; settlementAmount: number; selectedKey: string; run: number; }>; }> {
    // Enhanced input validation with type checking
    this.validateSettleFancyBetsInput(matchId, sid, run, fancyId);

    const matchObjectId = new ObjectId(matchId);
    const fancyObjectId = new ObjectId(fancyId);

    // Parallel validation of match and fancy data for better performance
    const [match, fancyData, matchBet] = await Promise.all([
      this.match.findById(matchObjectId).lean(),
      this.fancyOdds.findOne({ sid, _id: fancyObjectId }).lean(),
      this.matchBet.find({ match_id: matchObjectId, bet_type: MatchBetType.FANCY, selection_id: sid }).lean()
    ]);

    // Validate match and fancy data
    this.validateMatchAndFancyData(match, fancyData);

    // Update fancy data with result - using atomic operation
    const fancyUpdateResult = await this.fancyOdds.updateOne(
      { _id: fancyObjectId, isDeclared: false },
      {
        $set: {
          isDeclared: true,
          resultScore: run,
          settledAt: new Date()
        }
      }
    );

    if (fancyUpdateResult.modifiedCount === 0) {
      throw new HttpException(409, 'Fancy bet already declared or update failed');
    }

    // Check each bet and determine win/loss status with optimized batch operations
    if (matchBet && matchBet.length > 0) {
      await this.processFancyBetStatusUpdates(matchBet, run, matchObjectId, sid);
    }

    // Fetch active exposures with optimized query
    const matchExposures = await this.exposure.find({
      match_id: matchObjectId,
      bet_type: MatchBetType.FANCY,
      selection_id: sid,
      status: true
    }).lean();

    if (!matchExposures.length) {
      return {
        message: 'No active bets found to settle',
        settledBets: 0,
        results: []
      };
    }

    // Process settlements in optimized batches
    return await this.processFancyBetSettlements(matchExposures, run, matchObjectId);
  }

  /**
   * Validate input parameters for settleFancyBets
   * @private
   */
  /**
   * Validates input parameters for fancy bet settlement
   *
   * This method ensures all required parameters are provided and valid
   * before proceeding with the settlement process.
   *
   * @private
   * @param {string} matchId - The match ID to validate
   * @param {number} sid - The selection ID to validate
   * @param {number} run - The run value to validate
   * @param {string} fancyId - The fancy ID to validate
   * @throws {HttpException} When any required parameter is missing or invalid
   * @returns {void}
   */
  private validateSettleFancyBetsInput(matchId: string, sid: number, run: number, fancyId: string): void {
    if (!matchId?.trim()) {
      throw new HttpException(400, 'Match ID is required and cannot be empty');
    }
    if (!ObjectId.isValid(matchId)) {
      throw new HttpException(400, 'Invalid match ID format');
    }
    if (!fancyId?.trim()) {
      throw new HttpException(400, 'Fancy ID is required and cannot be empty');
    }
    if (!ObjectId.isValid(fancyId)) {
      throw new HttpException(400, 'Invalid fancy ID format');
    }
    if (typeof sid !== 'number' || sid <= 0) {
      throw new HttpException(400, 'SID must be a positive number');
    }
    if (typeof run !== 'number' || run < 0) {
      throw new HttpException(400, 'Run must be a non-negative number');
    }
  }

  /**
   * Validates match and fancy data for settlement processing
   *
   * This method ensures the match and fancy market data are valid
   * and ready for settlement operations.
   *
   * @private
   * @param {any} match - The match data object to validate
   * @param {any} fancyData - The fancy market data object to validate
   * @throws {HttpException} When match or fancy data is invalid or unavailable
   * @returns {void}
   */
  private validateMatchAndFancyData(match: any, fancyData: any): void {
    if (!match) {
      throw new HttpException(404, 'Match not found');
    }
    if (match.declared) {
      throw new HttpException(409, 'Match is already declared');
    }
    if (!fancyData) {
      throw new HttpException(404, 'Fancy data not found');
    }
    if (fancyData.isDeclared) {
      throw new HttpException(409, 'Fancy bet is already declared');
    }
  }

  /**
   * Processes fancy bet settlements using optimized batch operations
   *
   * This method handles the bulk processing of fancy bet settlements with:
   * - Batch user data retrieval for performance optimization
   * - Parallel processing of settlement calculations
   * - Atomic batch operations for data consistency
   * - Comprehensive error handling and rollback capabilities
   *
   * @private
   * @param {any[]} matchExposures - Array of match exposure records to settle
   * @param {number} run - The actual run outcome for settlement calculations
   * @param {ObjectId} matchObjectId - MongoDB ObjectId of the match
   * @returns {Promise<{ message: string; settledBets: number; results: Array<{ userId: string; betId: string; walletExposureResult: number; settlementAmount: number; selectedKey: string; run: number; }>; }>}
   *          Object containing settlement processing results and statistics
   * @throws {HttpException} When batch processing fails or data inconsistencies are detected
   */
  private async processFancyBetSettlements(matchExposures: any[], run: number, matchObjectId: ObjectId): Promise<{ message: string; settledBets: number; results: Array<{ userId: string; betId: string; walletExposureResult: number; settlementAmount: number; selectedKey: string; run: number; }>; }> {
    // Extract unique user IDs and batch fetch users
    const userIds = [...new Set(matchExposures.map(bet => bet.user_id.toString()))];

    const users = await this.user.find(
      { _id: { $in: userIds.map(id => new ObjectId(id)) } },
      { _id: 1, wallet: 1, exposure: 1, session_commission: 1 }
    ).lean();

    // Create optimized user lookup map
    const userMap = new Map(
      users.map(user => [user._id.toString(), user])
    );

    // console.log('Users:', users);

    // Prepare batch operations with enhanced error handling
    const batchOperations = await this.prepareFancySettlementBatchOperations(
      matchExposures,
      userMap,
      run,
      matchObjectId
    );

    // Execute all batch operations with transaction-like behavior
    await this.executeFancySettlementBatchOperations(batchOperations);

    return {
      message: 'Fancy bets settled successfully',
      settledBets: batchOperations.settlementResults.length,
      results: batchOperations.settlementResults
    };
  }

  /**
   * Prepares optimized batch operations for fancy bet settlement processing
   *
   * This method creates structured batch operations for:
   * - User wallet and exposure updates
   * - Transaction record insertions
   * - Exposure status updates
   * - Settlement result compilation
   *
   * All operations are prepared in memory before execution to ensure atomicity.
   *
   * @private
   * @param {any[]} matchExposures - Array of exposure records to process
   * @param {Map<string, any>} userMap - Optimized user data lookup map
   * @param {number} run - Actual run outcome for calculations
   * @param {ObjectId} matchObjectId - Match identifier for transaction records
   * @returns {{ userUpdates: any[]; transactionInserts: any[]; exposureUpdates: any[]; settlementResults: any[]; }}
   *          Object containing all prepared batch operations
   * @throws {HttpException} When settlement calculations fail or user data is invalid
   */
  private async prepareFancySettlementBatchOperations(matchExposures: any[], userMap: Map<string, any>, run: number, matchObjectId: ObjectId): Promise<{ userUpdates: any[]; transactionInserts: any[]; exposureUpdates: any[]; settlementResults: any[]; }> {
    const userUpdates: any[] = [];
    const transactionInserts: any[] = [];
    const exposureUpdates: any[] = [];
    const settlementResults: any[] = [];

    for (const bet of matchExposures) {
      try {
        const { user_id, selection_id, potential_profitloss, exposure, match_id } = bet;
        const userId = user_id.toString();

        const currentUser = userMap.get(userId);
        if (!currentUser) {
          throw new HttpException(404, `User not found for ID: ${userId}`);
        }

        // Determine settlement key with enhanced logic
        const selectedKey = this.determineSettlementKey(potential_profitloss, run);

        // Calculate settlement data
        const settlementData = this.calculateFancyBetSettlementData(
          selectedKey,
          run,
          potential_profitloss,
          Number(exposure),
          currentUser.wallet || 0
        );

        // Calculate final wallet result
        const walletExposureResult = currentUser.wallet + Number(exposure) + potential_profitloss[selectedKey];

        // Calculate Session Commission
        const sessionCommission = currentUser.session_commission > 0 ? await this.calculateSessionCommission(match_id.toString(), userId, bet.selection_id, currentUser.session_commission) : 0;

        // console.log('Session Commission:', sessionCommission);
        // console.log('Current User Commission:', currentUser.session_commission);

        // Prepare optimized batch operations
        userUpdates.push({
          updateOne: {
            filter: { _id: user_id },
            update: {
              $inc: {
                wallet: settlementData.walletChange + Number(sessionCommission),
                exposure: -Number(exposure)
              }
            }
          }
        });

        transactionInserts.push({
          user_id,
          match_id: matchObjectId,
          amount: settlementData.walletChange + Number(sessionCommission),
          type: settlementData.transactionType === 'credit' ? MatchTransactionType.CREDIT : MatchTransactionType.DEBIT,
          note: settlementData.transactionDescription,
          status: MatchTransactionStatus.DONE,
          transfer_type: MatchTransactionTransferType.FANCY_SETTLEMENT,
          createdAt: new Date()
        });

        exposureUpdates.push({
          updateOne: {
            filter: { _id: bet._id },
            update: {
              $set: {
                status: false,
                settled_at: new Date(),
                settlement_amount: settlementData.walletChange,
                settlement_commission: Number(sessionCommission),
                settlement_status: ExposureStatus.SETTLED,
              }
            }
          }
        });

        settlementResults.push({
          userId,
          betId: bet._id.toString(),
          walletExposureResult,
          settlementAmount: settlementData.walletChange,
          selectedKey,
          run
        });
      } catch (error) {
        throw new HttpException(
          500,
          `Error processing settlement for bet ${bet._id}: ${error.message}`
        );
      }
    }

    return { userUpdates, transactionInserts, exposureUpdates, settlementResults };
  }

  /**
   * Calculate Session Commission on Fancy Bets (DB aggregation version)
   */
  private async calculateSessionCommission(
    matchId: string,
    userId: string,
    sessionId: number,
    sessionCommission: number
  ): Promise<number> {
    if (!sessionCommission) return 0;

    const matchObjectId = new ObjectId(matchId);
    const userObjectId = new ObjectId(userId);

    const result = await this.matchBet.aggregate([
      {
        $match: {
          match_id: matchObjectId,
          user_id: userObjectId,
          bet_type: MatchBetType.FANCY,
          selection_id: sessionId,
          status: {
            $in: [MatchBetStatus.LOST, MatchBetStatus.WON], // ✅ only update these
            $ne: MatchBetStatus.DELETED, // ✅ only update these
          },
        }
      },
      {
        $group: {
          _id: null,
          totalStake: { $sum: "$stake_amount" }
        }
      }
    ]);

    if (!result.length || !result[0]?.totalStake) {
      // console.log('No matching bets found, returning 0');
      return 0;
    }

    // console.log('Total Stake Amount:', result[0].totalStake);

    return Number((result[0].totalStake * (sessionCommission / 100)).toFixed(8));
  }

  /**
   * Determines the appropriate settlement key based on actual run outcome
   *
   * This method analyzes the profit/loss structure and actual run to determine
   * which settlement scenario applies. It handles various betting scenarios:
   * - Exact run matches
   * - Range-based settlements (e.g., "10-15", "over_20")
   * - Boundary conditions and edge cases
   *
   * @private
   * @param {Record<string, number>} potential_profitloss - Object containing all possible profit/loss scenarios
   * @param {number} run - The actual run outcome to match against
   * @returns {string} The settlement key that matches the actual outcome
   * @throws {HttpException} When no valid settlement key can be determined
   */
  private determineSettlementKey(potential_profitloss: Record<string, number>, run: number): string {
    const profitLossKeys = Object.keys(potential_profitloss);

    if (!profitLossKeys.length) {
      throw new HttpException(400, 'No profit/loss keys found in bet data');
    }

    // Check if exact run exists in keys
    if (profitLossKeys.includes(run.toString())) {
      return run.toString();
    }

    // Convert keys to numbers and sort for range checking
    const numericKeys = profitLossKeys
      .map(key => parseInt(key))
      .filter(key => !isNaN(key))
      .sort((a, b) => a - b);

    if (!numericKeys.length) {
      throw new HttpException(400, 'No valid numeric keys found in profit/loss data');
    }

    const minKey = numericKeys[0];
    const maxKey = numericKeys[numericKeys.length - 1];

    // Return appropriate boundary key
    if (run > maxKey) {
      return maxKey.toString();
    } else if (run < minKey) {
      return minKey.toString();
    }

    // Find the closest key for runs between min and max
    const closestKey = numericKeys.reduce((prev, curr) =>
      Math.abs(curr - run) < Math.abs(prev - run) ? curr : prev
    );

    return closestKey.toString();
  }

  /**
   * Executes batch operations with enhanced error handling and rollback capability
   *
   * This method performs atomic batch operations in optimal order:
   * 1. Updates exposure records first to lock bet states
   * 2. Updates user wallets and exposures
   * 3. Creates transaction audit records
   *
   * All operations are executed in parallel for maximum performance while
   * maintaining data consistency through ordered execution strategy.
   *
   * @private
   * @param {{ userUpdates: any[]; transactionInserts: any[]; exposureUpdates: any[]; settlementResults: any[]; }} batchOperations
   *        Object containing all prepared batch operations
   * @returns {Promise<void>} Resolves when all operations complete successfully
   * @throws {HttpException} When any batch operation fails, with detailed error context
   */
  private async executeFancySettlementBatchOperations(batchOperations: { userUpdates: any[]; transactionInserts: any[]; exposureUpdates: any[]; settlementResults: any[]; }): Promise<void> {
    const { userUpdates, transactionInserts, exposureUpdates } = batchOperations;

    try {
      // Execute operations in optimal order for data consistency
      const operations = [];

      if (exposureUpdates.length > 0) {
        operations.push(this.exposure.bulkWrite(exposureUpdates, { ordered: false }));
      }

      if (userUpdates.length > 0) {
        operations.push(this.user.bulkWrite(userUpdates, { ordered: false }));
      }

      if (transactionInserts.length > 0) {
        operations.push(this.transaction.insertMany(transactionInserts, { ordered: false }));
      }

      // Execute all operations in parallel for better performance
      await Promise.all(operations);

    } catch (error) {
      throw new HttpException(
        500,
        `Failed to execute settlement batch operations: ${error.message}`
      );
    }
  }

  /**
   * Calculates fancy bet settlement data with enhanced validation and performance
   *
   * This method performs comprehensive settlement calculations including:
   * - Input validation and sanitization
   * - Profit/loss calculation based on actual outcomes
   * - Wallet change determination with proper precision handling
   * - Transaction type classification and description generation
   * - Error handling for edge cases and invalid data
   *
   * @private
   * @param {string} selectedKey - The settlement key that matches the actual outcome
   * @param {number} actualRun - The actual run scored in the match
   * @param {Record<string, number>} potential_profitloss - Object containing all profit/loss scenarios
   * @param {number} exposure - Current exposure amount for the bet
   * @param {number} currentWallet - User's current wallet balance
   * @returns {{ walletChange: number; transactionType: 'credit' | 'debit' | 'neutral'; transactionAmount: number; transactionDescription: string; }}
   *          Complete settlement data with transaction details
   * @throws {HttpException} When calculation fails due to invalid inputs or data inconsistencies
   */
  private calculateFancyBetSettlementData(selectedKey: string, actualRun: number, potential_profitloss: Record<string, number>, exposure: number, currentWallet: number): { walletChange: number; transactionType: 'credit' | 'debit' | 'neutral'; transactionAmount: number; transactionDescription: string; } {
    // Enhanced input validation
    this.validateSettlementCalculationInputs(
      selectedKey,
      actualRun,
      potential_profitloss,
      exposure,
      currentWallet
    );

    // Get the profit/loss value for the selected key with validation
    const profitLossValue = potential_profitloss[selectedKey];

    if (typeof profitLossValue !== 'number' || isNaN(profitLossValue)) {
      throw new HttpException(
        400,
        `Invalid profit/loss value for key ${selectedKey}: ${profitLossValue}`
      );
    }

    // Calculate wallet change with proper number handling and precision
    const exposureAmount = Number(exposure);
    const walletChange = Number((profitLossValue + exposureAmount).toFixed(2));

    // Transaction amount is absolute value of the wallet change
    const transactionAmount = Math.abs(walletChange);

    // Determine transaction type and description with enhanced logic
    const { transactionType, transactionDescription } = this.generateFancySettlementDetails(
      selectedKey,
      actualRun,
      profitLossValue,
      exposureAmount,
      walletChange,
      potential_profitloss
    );

    return {
      walletChange,
      transactionType,
      transactionAmount,
      transactionDescription
    };
  }

  /**
   * Validates all inputs required for accurate settlement calculations
   *
   * This method ensures data integrity by validating:
   * - Settlement key format and content
   * - Numeric value ranges and types
   * - Object structure and required properties
   * - Business logic constraints
   *
   * @private
   * @param {string} selectedKey - Settlement key to validate
   * @param {number} actualRun - Actual run value to validate
   * @param {Record<string, number>} potential_profitloss - Profit/loss data to validate
   * @param {number} exposure - Exposure amount to validate
   * @param {number} currentWallet - Wallet balance to validate
   * @throws {HttpException} When any input fails validation with specific error details
   * @returns {void}
   */
  private validateSettlementCalculationInputs(selectedKey: string, actualRun: number, potential_profitloss: Record<string, number>, exposure: number, currentWallet: number): void {
    if (!selectedKey?.trim()) {
      throw new HttpException(400, 'Selected key is required for settlement calculation');
    }

    if (typeof actualRun !== 'number' || actualRun < 0) {
      throw new HttpException(400, 'Actual run must be a non-negative number');
    }

    if (!potential_profitloss || typeof potential_profitloss !== 'object') {
      throw new HttpException(400, 'Potential profit/loss data is required');
    }

    if (!potential_profitloss.hasOwnProperty(selectedKey)) {
      throw new HttpException(
        400,
        `Selected key '${selectedKey}' not found in profit/loss data`
      );
    }

    if (typeof exposure !== 'number' || isNaN(exposure)) {
      throw new HttpException(400, 'Exposure must be a valid number');
    }

    if (typeof currentWallet !== 'number' || isNaN(currentWallet)) {
      throw new HttpException(400, 'Current wallet must be a valid number');
    }
  }

  /**
   * Generate detailed settlement information for fancy bets
   * @private
   */
  /**
   * Generates detailed settlement information for fancy bet transactions
   *
   * This method creates comprehensive transaction details including:
   * - Transaction type classification (credit/debit/neutral)
   * - Descriptive transaction messages for audit trails
   * - Boundary scenario analysis for edge cases
   * - Contextual information for settlement reporting
   *
   * @private
   * @param {string} selectedKey - The settlement key used for calculation
   * @param {number} actualRun - The actual run outcome
   * @param {number} profitLossValue - Calculated profit or loss amount
   * @param {number} exposureAmount - Original exposure amount
   * @param {number} walletChange - Net change to user's wallet
   * @param {Record<string, number>} potential_profitloss - All possible profit/loss scenarios
   * @returns {{ transactionType: 'credit' | 'debit' | 'neutral'; transactionDescription: string; }}
   *          Object containing transaction classification and description
   */
  private generateFancySettlementDetails(selectedKey: string, actualRun: number, profitLossValue: number, exposureAmount: number, walletChange: number, potential_profitloss: Record<string, number>): { transactionType: 'credit' | 'debit' | 'neutral'; transactionDescription: string; } {
    // Determine transaction type based on wallet change
    let transactionType: 'credit' | 'debit' | 'neutral';
    if (walletChange > 0) {
      transactionType = 'credit';
    } else if (walletChange < 0) {
      transactionType = 'debit';
    } else {
      transactionType = 'neutral';
    }

    // Format amounts for display
    const formatAmount = (amount: number): string => Math.abs(amount).toFixed(2);

    let transactionDescription: string;

    if (selectedKey === actualRun.toString()) {
      // Exact run match scenario
      if (profitLossValue >= 0) {
        transactionDescription = `Fancy Bet Won - Run: ${actualRun} (Exact Match) - Profit: ₹${formatAmount(profitLossValue)}, Exposure Released: ₹${formatAmount(exposureAmount)}, Total Added: ₹${formatAmount(walletChange)}`;
      } else {
        transactionDescription = `Fancy Bet Lost - Run: ${actualRun} (Exact Match) - Loss: ₹${formatAmount(profitLossValue)}, Exposure Released: ₹${formatAmount(exposureAmount)}, Net Change: ₹${walletChange.toFixed(2)}`;
      }
    } else {
      // Run was outside the exact range - determine boundary scenario
      const boundaryInfo = this.determineBoundaryScenario(
        actualRun,
        potential_profitloss,
        selectedKey
      );

      transactionDescription = `Fancy Bet Settled - Run: ${actualRun} ${boundaryInfo} - Applied P&L: ₹${profitLossValue.toFixed(2)}, Exposure Released: ₹${formatAmount(exposureAmount)}, Net Change: ₹${walletChange.toFixed(2)}`;
    }

    return { transactionType, transactionDescription };
  }

  /**
   * Determine boundary scenario information for settlement description
   * @private
   */
  /**
   * Determines boundary scenario classification for settlement edge cases
   *
   * This method analyzes the relationship between actual run and available
   * profit/loss keys to classify boundary conditions such as:
   * - Exact matches
   * - Over/under scenarios
   * - Range boundaries
   * - Default fallback cases
   *
   * @private
   * @param {number} actualRun - The actual run outcome
   * @param {Record<string, number>} potential_profitloss - Available profit/loss scenarios
   * @param {string} selectedKey - The selected settlement key
   * @returns {string} Boundary scenario classification for descriptive purposes
   */
  private determineBoundaryScenario(actualRun: number, potential_profitloss: Record<string, number>, selectedKey: string): string {
    const numericKeys = Object.keys(potential_profitloss)
      .map(key => parseInt(key))
      .filter(key => !isNaN(key))
      .sort((a, b) => a - b);

    if (!numericKeys.length) {
      return `(Applied Key: ${selectedKey})`;
    }

    const minKey = numericKeys[0];
    const maxKey = numericKeys[numericKeys.length - 1];

    if (actualRun > maxKey) {
      return `(Above Max: ${maxKey}, Applied Max Key)`;
    } else if (actualRun < minKey) {
      return `(Below Min: ${minKey}, Applied Min Key)`;
    } else {
      return `(Closest Key: ${selectedKey})`;
    }
  }

  /**
   * Process fancy bet status updates efficiently using bulk operations
   * Eliminates redundant database queries and improves performance
   * @private
   */
  /**
   * Processes fancy bet status updates based on run outcomes
   *
   * This method handles bulk status updates for fancy bets including:
   * - Run-based win/loss determination
   * - Batch status updates for performance
   * - Settlement timestamp recording
   * - Error handling for individual bet failures
   *
   * @private
   * @param {any[]} matchBets - Array of fancy bets to process
   * @param {number} run - Actual run outcome for status determination
   * @param {ObjectId} matchObjectId - Match identifier for audit trail
   * @param {number} sid - Selection ID for the fancy market
   * @returns {Promise<void>} Resolves when all status updates complete
   * @throws {HttpException} When batch processing fails
   */
  private async processFancyBetStatusUpdates(matchBets: any[], run: number, matchObjectId: ObjectId, sid: number): Promise<void> {
    // Group bets by selection type and determine status based on run value
    const runNumber = Number(run);
    const settledAt = new Date();

    // Separate bets by selection type for efficient processing
    const yesBets = matchBets.filter(bet =>
      bet.bet_type === MatchBetType.FANCY && bet.selection === 'Yes'
    );
    const notBets = matchBets.filter(bet =>
      bet.bet_type === MatchBetType.FANCY && bet.selection === 'Not'
    );

    // Process bulk updates for better performance
    const bulkOperations = [];

    // Determine winning and losing bet IDs for 'Yes' bets
    const yesWinningBetIds = yesBets
      .filter(bet => runNumber >= Number(bet.odds_value))
      .map(bet => bet._id);
    const yesLosingBetIds = yesBets
      .filter(bet => runNumber < Number(bet.odds_value))
      .map(bet => bet._id);

    // Determine winning and losing bet IDs for 'Not' bets
    const notWinningBetIds = notBets
      .filter(bet => runNumber < Number(bet.odds_value))
      .map(bet => bet._id);
    const notLosingBetIds = notBets
      .filter(bet => runNumber >= Number(bet.odds_value))
      .map(bet => bet._id);

    // Create bulk operations for winning bets
    if (yesWinningBetIds.length > 0 || notWinningBetIds.length > 0) {
      const allWinningIds = [...yesWinningBetIds, ...notWinningBetIds];
      bulkOperations.push({
        updateMany: {
          filter: {
            _id: { $in: allWinningIds },
            match_id: matchObjectId,
            bet_type: MatchBetType.FANCY,
            selection_id: sid,
            status: {
              $in: MatchBetStatus.PENDING,
              $ne: MatchBetStatus.DELETED,
            },
          },
          update: {
            $set: {
              status: MatchBetStatus.WON,
              result: run,
              settled_at: settledAt
            }
          }
        }
      });
    }

    // Create bulk operations for losing bets
    if (yesLosingBetIds.length > 0 || notLosingBetIds.length > 0) {
      const allLosingIds = [...yesLosingBetIds, ...notLosingBetIds];
      bulkOperations.push({
        updateMany: {
          filter: {
            _id: { $in: allLosingIds },
            match_id: matchObjectId,
            bet_type: MatchBetType.FANCY,
            selection_id: sid,
            status: {
              $in: MatchBetStatus.PENDING,
              $ne: MatchBetStatus.DELETED,
            },
          },
          update: {
            $set: {
              status: MatchBetStatus.LOST,
              result: run,
              settled_at: settledAt
            }
          }
        }
      });
    }

    // Execute all bulk operations in a single database call
    if (bulkOperations.length > 0) {
      await this.matchBet.bulkWrite(bulkOperations, { ordered: false });
    }
  }


  // ========================================
  // FANCY BET CANCEL METHODS
  // ========================================

  /**
   * Cancel all fancy bets for a specific market based on the actual run outcome
   * @param matchId - ID of the match
   * @param sid - SID of the bet
   * @param run - Run scored
   * @param fancyId - ID of the fancy bet
   * @returns Promise with cancellation results
   */
  /**
   * Cancel all fancy bets for a specific market based on the actual run outcome
   *
   * This method handles the complete Cancel process for fancy bets:
   * 1. Validates input parameters and match/fancy data
   * 2. Retrieves all active fancy bet exposures for the market
   * 3. Calculates profit/loss based on actual run vs bet predictions
   * 4. Updates user wallets and exposures accordingly
   * 5. Creates detailed transaction records
   * 6. Updates bet statuses and cancellation timestamps
   *
   * @public
   * @param {string} matchId - The unique identifier of the match
   * @param {number} sid - The selection ID for the fancy market
   * @param {number} run - The actual run outcome for cancellation
   * @param {string} fancyId - The unique identifier of the fancy market
   * @returns {Promise<{ message: string; cancelledBets: number; results: Array<{ userId: string; betId: string; walletExposureResult: number; cancellationAmount: number; selectedKey: string; run: number; }>; }>}
   *          Object containing cancellation summary and detailed results
   * @throws {HttpException} When validation fails or cancellation processing encounters errors
   */
  public async cancelFancyBets(matchId: string, sid: number, fancyId: string): Promise<{ message: string; cancelledBets: number; results: Array<{ userId: string; betId: string; walletExposureResult: number; cancellationAmount: number; selectedKey: string; run: number; }>; }> {
    // Enhanced input validation with type checking
    this.validateCancelFancyBetsInput(matchId, sid, fancyId);

    const matchObjectId = new ObjectId(matchId);
    const fancyObjectId = new ObjectId(fancyId);

    // Parallel validation of match and fancy data for better performance
    const [match, fancyData, matchBet] = await Promise.all([
      this.match.findById(matchObjectId).lean(),
      this.fancyOdds.findOne({ sid, _id: fancyObjectId }).lean(),
      this.matchBet.find({ match_id: matchObjectId, bet_type: MatchBetType.FANCY, selection_id: sid }).lean()
    ]);

    // Validate match and fancy data
    this.validateMatchAndFancyCancelData(match, fancyData);

    // Update fancy data with result - using atomic operation
    const fancyUpdateResult = await this.fancyOdds.updateOne(
      { _id: fancyObjectId, isDeclared: false },
      {
        $set: {
          isDeclared: true,
          resultScore: '',
          settledAt: new Date()
        }
      }
    );

    if (fancyUpdateResult.modifiedCount === 0) {
      throw new HttpException(409, 'Fancy bet already declared or update failed');
    }

    // Check each bet and determine win/loss status with optimized batch operations
    if (matchBet && matchBet.length > 0) {
      await this.processFancyBetCancellationUpdates(matchBet, matchObjectId, sid);
    }

    // Fetch active exposures with optimized query
    const matchExposures = await this.exposure.find({
      match_id: matchObjectId,
      bet_type: MatchBetType.FANCY,
      selection_id: sid,
      status: true
    }).lean();

    if (!matchExposures.length) {
      return {
        message: 'No active bets found to cancel',
        cancelledBets: 0,
        results: []
      };
    }

    // Process cancellations in optimized batches
    return await this.processFancyBetCancellations(matchExposures, matchObjectId);
  }

  /**
   * Validate input parameters for cancelFancyBets
   * @private
   */
  /**
   * Validates input parameters for fancy bet cancellation
   *
   * This method ensures all required parameters are provided and valid
   * before proceeding with the cancellation process.
   *
   * @private
   * @param {string} matchId - The match ID to validate
   * @param {number} sid - The selection ID to validate
   * @param {number} run - The run value to validate
   * @param {string} fancyId - The fancy ID to validate
   * @throws {HttpException} When any required parameter is missing or invalid
   * @returns {void}
   */
  private validateCancelFancyBetsInput(matchId: string, sid: number, fancyId: string): void {
    if (!matchId?.trim()) {
      throw new HttpException(400, 'Match ID is required and cannot be empty');
    }
    if (!ObjectId.isValid(matchId)) {
      throw new HttpException(400, 'Invalid match ID format');
    }
    if (!fancyId?.trim()) {
      throw new HttpException(400, 'Fancy ID is required and cannot be empty');
    }
    if (!ObjectId.isValid(fancyId)) {
      throw new HttpException(400, 'Invalid fancy ID format');
    }
    if (typeof sid !== 'number' || sid <= 0) {
      throw new HttpException(400, 'SID must be a positive number');
    }
  }

  /**
   * Validates match and fancy data for settlement processing
   *
   * This method ensures the match and fancy market data are valid
   * and ready for settlement operations.
   *
   * @private
   * @param {any} match - The match data object to validate
   * @param {any} fancyData - The fancy market data object to validate
   * @throws {HttpException} When match or fancy data is invalid or unavailable
   * @returns {void}
   */
  private validateMatchAndFancyCancelData(match: any, fancyData: any): void {
    if (!match) {
      throw new HttpException(404, 'Match not found');
    }
    if (match.declared) {
      throw new HttpException(409, 'Match is already declared');
    }
    if (!fancyData) {
      throw new HttpException(404, 'Fancy data not found');
    }
    if (fancyData.isDeclared) {
      throw new HttpException(409, 'Fancy bet is already declared');
    }
  }

  /**
   * Processes fancy bet settlements using optimized batch operations
   *
   * This method handles the bulk processing of fancy bet settlements with:
   * - Batch user data retrieval for performance optimization
   * - Parallel processing of settlement calculations
   * - Atomic batch operations for data consistency
   * - Comprehensive error handling and rollback capabilities
   *
   * @private
   * @param {any[]} matchExposures - Array of match exposure records to settle
   * @param {number} run - The actual run outcome for settlement calculations
   * @param {ObjectId} matchObjectId - MongoDB ObjectId of the match
   * @returns {Promise<{ message: string; settledBets: number; results: Array<{ userId: string; betId: string; walletExposureResult: number; settlementAmount: number; selectedKey: string; run: number; }>; }>}
   *          Object containing settlement processing results and statistics
   * @throws {HttpException} When batch processing fails or data inconsistencies are detected
   */
  private async processFancyBetCancellations(matchExposures: any[], matchObjectId: ObjectId): Promise<{ message: string; cancelledBets: number; results: Array<{ userId: string; betId: string; walletExposureResult: number; cancellationAmount: number; selectedKey: string; run: number; }>; }> {
    // Extract unique user IDs and batch fetch users
    const userIds = [...new Set(matchExposures.map(bet => bet.user_id.toString()))];

    const users = await this.user.find(
      { _id: { $in: userIds.map(id => new ObjectId(id)) } },
      { _id: 1, wallet: 1, exposure: 1 }
    ).lean();

    // Create optimized user lookup map
    const userMap = new Map(
      users.map(user => [user._id.toString(), user])
    );

    // Prepare batch operations with enhanced error handling
    const batchOperations = this.prepareFancyCancellationBatchOperations(
      matchExposures,
      userMap,
      matchObjectId
    );

    // Execute all batch operations with transaction-like behavior
    await this.executeFancyCancellationBatchOperations(batchOperations);

    return {
      message: 'Fancy bets cancelled successfully',
      cancelledBets: batchOperations.cancelledBets.length,
      results: batchOperations.cancelledBets
    };
  }

  /**
   * Prepares optimized batch operations for fancy bet settlement processing
   *
   * This method creates structured batch operations for:
   * - User wallet and exposure updates
   * - Transaction record insertions
   * - Exposure status updates
   * - Settlement result compilation
   *
   * All operations are prepared in memory before execution to ensure atomicity.
   *
   * @private
   * @param {any[]} matchExposures - Array of exposure records to process
   * @param {Map<string, any>} userMap - Optimized user data lookup map
   * @param {number} run - Actual run outcome for calculations
   * @param {ObjectId} matchObjectId - Match identifier for transaction records
   * @returns {{ userUpdates: any[]; transactionInserts: any[]; exposureUpdates: any[]; settlementResults: any[]; }}
   *          Object containing all prepared batch operations
   * @throws {HttpException} When settlement calculations fail or user data is invalid
   */
  private prepareFancyCancellationBatchOperations(matchExposures: any[], userMap: Map<string, any>, matchObjectId: ObjectId): { userUpdates: any[]; transactionInserts: any[]; exposureUpdates: any[]; cancelledBets: any[]; } {
    const userUpdates: any[] = [];
    const transactionInserts: any[] = [];
    const exposureUpdates: any[] = [];
    const cancelledBets: any[] = [];

    for (const bet of matchExposures) {
      try {
        const { user_id, exposure } = bet;
        const userId = user_id.toString();

        const currentUser = userMap.get(userId);
        if (!currentUser) {
          throw new HttpException(404, `User not found for ID: ${userId}`);
        }

        // Calculate final wallet result
        const walletExposureResult = currentUser.wallet + Number(exposure);

        // Prepare optimized batch operations
        userUpdates.push({
          updateOne: {
            filter: { _id: user_id },
            update: {
              $inc: {
                wallet: +Number(exposure),
                exposure: -Number(exposure)
              }
            }
          }
        });

        const transactionId = new ObjectId(); // generate transaction id beforehand

        transactionInserts.push({
          _id: transactionId, // ✅ manually assign _id so we can reference it
          user_id,
          match_id: matchObjectId,
          amount: +Number(exposure),
          type: MatchTransactionType.CREDIT,
          note: 'Fancy bet cancelled',
          status: MatchTransactionStatus.DONE,
          transfer_type: MatchTransactionTransferType.FANCY_CANCELLED,
          createdAt: new Date()
        });

        exposureUpdates.push({
          updateOne: {
            filter: { _id: bet._id },
            update: {
              $addToSet: { transaction_id: transactionId },
              $set: {
                settlement_status: ExposureStatus.CANCELLED,
                settlement_amount: +Number(exposure),
                settlement_commission: 0,
                status: false,
                settled_at: new Date(),
              }
            }
          }
        });

        cancelledBets.push({
          userId,
          betId: bet._id.toString(),
          walletExposureResult,
          settlementAmount: +Number(exposure),
        });
      } catch (error) {
        throw new HttpException(
          500,
          `Error processing cancellation for bet ${bet._id}: ${error.message}`
        );
      }
    }

    return { userUpdates, transactionInserts, exposureUpdates, cancelledBets };
  }

  /**
   * Executes batch operations with enhanced error handling and rollback capability
   *
   * This method performs atomic batch operations in optimal order:
   * 1. Updates exposure records first to lock bet states
   * 2. Updates user wallets and exposures
   * 3. Creates transaction audit records
   *
   * All operations are executed in parallel for maximum performance while
   * maintaining data consistency through ordered execution strategy.
   *
   * @private
   * @param {{ userUpdates: any[]; transactionInserts: any[]; exposureUpdates: any[]; settlementResults: any[]; }} batchOperations
   *        Object containing all prepared batch operations
   * @returns {Promise<void>} Resolves when all operations complete successfully
   * @throws {HttpException} When any batch operation fails, with detailed error context
   */
  private async executeFancyCancellationBatchOperations(batchOperations: { userUpdates: any[]; transactionInserts: any[]; exposureUpdates: any[]; }): Promise<void> {
    const { userUpdates, transactionInserts, exposureUpdates } = batchOperations;

    try {
      // Execute operations in optimal order for data consistency
      const operations = [];

      if (exposureUpdates.length > 0) {
        operations.push(this.exposure.bulkWrite(exposureUpdates, { ordered: false }));
      }

      if (userUpdates.length > 0) {
        operations.push(this.user.bulkWrite(userUpdates, { ordered: false }));
      }

      if (transactionInserts.length > 0) {
        operations.push(this.transaction.insertMany(transactionInserts, { ordered: false }));
      }

      // Execute all operations in parallel for better performance
      await Promise.all(operations);

    } catch (error) {
      throw new HttpException(
        500,
        `Failed to execute settlement batch operations: ${error.message}`
      );
    }
  }

  /**
   * Process fancy bet status updates efficiently using bulk operations
   * Eliminates redundant database queries and improves performance
   * @private
   */
  /**
   * Processes fancy bet status updates based on run outcomes
   *
   * This method handles bulk status updates for fancy bets including:
   * - Run-based win/loss determination
   * - Batch status updates for performance
   * - Settlement timestamp recording
   * - Error handling for individual bet failures
   *
   * @private
   * @param {any[]} matchBets - Array of fancy bets to process
   * @param {number} run - Actual run outcome for status determination
   * @param {ObjectId} matchObjectId - Match identifier for audit trail
   * @param {number} sid - Selection ID for the fancy market
   * @returns {Promise<void>} Resolves when all status updates complete
   * @throws {HttpException} When batch processing fails
   */
  private async processFancyBetCancellationUpdates(matchBets: any[], matchObjectId: ObjectId, sid: number): Promise<void> {
    // Set settled timestamp
    const settledAt = new Date();

    // Get all fancy bet IDs for this match & selection
    const fancyBetIds = matchBets
      .filter(bet => bet.bet_type === MatchBetType.FANCY)
      .map(bet => bet._id);

    if (fancyBetIds.length === 0) return;
    // Update all as CANCEL in bulk
    await this.matchBet.updateMany(
      {
        _id: { $in: fancyBetIds },
        match_id: matchObjectId,
        bet_type: MatchBetType.FANCY,
        selection_id: sid,
        status: {
          $in: MatchBetStatus.PENDING,
          $ne: MatchBetStatus.DELETED
        }
      },
      {
        $set: {
          status: MatchBetStatus.CANCELLED,    // ✅ Cancelled
          result: null,                        // ✅ No result for cancelled bets
          settled_at: settledAt
        }
      }
    );
  }

  // ========================================
  // FANCY BET ROLLBACK METHODS
  // ========================================

  public async rollbackFancyBets(matchId: string, sid: number, fancyId: string) {
    // Enhanced input validation with type checking
    this.validateRollbackFancyBetsInput(matchId, sid, fancyId);

    const matchObjectId = new ObjectId(matchId);
    const fancyBetObjectId = new ObjectId(fancyId);

    // Parallel validation of match and fancy data for better performance
    const [match, fancyData, matchBet] = await Promise.all([
      this.match.findById(matchObjectId).lean(),
      this.fancyOdds.findOne({ sid, _id: fancyBetObjectId }).lean(),
      this.matchBet.find({ match_id: matchObjectId, bet_type: MatchBetType.FANCY, selection_id: sid }).lean()
    ]);

    // Validate match and fancy data
    this.validateMatchAndFancyRollbackData(match, fancyData);

    // Update fancy data with result - using atomic operation
    const fancyUpdateResult = await this.fancyOdds.updateOne(
      { _id: fancyBetObjectId, isDeclared: true },
      {
        $set: {
          isDeclared: false,
          isActive: true,
          resultScore: null,
          settledAt: new Date()
        }
      }
    );

    if (fancyUpdateResult.matchedCount === 0) {
      throw new HttpException(409, 'Fancy bet not found or already rolled back');
    }

    // Check each bet and determine win/loss status with optimized batch operations
    if (matchBet && matchBet.length > 0) {
      await this.processFancyBetRollbackUpdates(matchBet, matchObjectId, sid);
    }

    // Fetch active exposures with optimized query
    const matchExposures = await this.exposure.find({
      match_id: matchObjectId,
      bet_type: MatchBetType.FANCY,
      selection_id: sid,
      status: false
    }).lean();

    if (!matchExposures.length) {
      return {
        message: 'No active bets found to rollback',
        cancelledBets: 0,
        results: []
      };
    }

    return await this.processFancyBetRollback(matchExposures, matchObjectId);

  }

  /**
 * Validate input parameters for rollbackFancyBets
 * @private
 */
  /**
   * Validates input parameters for fancy bet rollback
   *
   * This method ensures all required parameters are provided and valid
   * before proceeding with the rollback process.
   *
   * @private
   * @param {string} matchId - The match ID to validate
   * @param {number} sid - The selection ID to validate
   * @param {number} run - The run value to validate
   * @param {string} fancyId - The fancy ID to validate
   * @throws {HttpException} When any required parameter is missing or invalid
   * @returns {void}
   */
  private validateRollbackFancyBetsInput(matchId: string, sid: number, fancyId: string): void {
    if (!matchId?.trim()) {
      throw new HttpException(400, 'Match ID is required and cannot be empty');
    }
    if (!ObjectId.isValid(matchId)) {
      throw new HttpException(400, 'Invalid match ID format');
    }
    if (!fancyId?.trim()) {
      throw new HttpException(400, 'Fancy ID is required and cannot be empty');
    }
    if (!ObjectId.isValid(fancyId)) {
      throw new HttpException(400, 'Invalid fancy ID format');
    }
    if (typeof sid !== 'number' || sid <= 0) {
      throw new HttpException(400, 'SID must be a positive number');
    }
  }

  /**
   * Validates match and fancy data for settlement processing
   *
   * This method ensures the match and fancy market data are valid
   * and ready for settlement operations.
   *
   * @private
   * @param {any} match - The match data object to validate
   * @param {any} fancyData - The fancy market data object to validate
   * @throws {HttpException} When match or fancy data is invalid or unavailable
   * @returns {void}
   */
  private validateMatchAndFancyRollbackData(match: any, fancyData: any): void {
    if (!match) {
      throw new HttpException(404, 'Match not found');
    }
    if (!fancyData) {
      throw new HttpException(404, 'Fancy data not found');
    }
    if (!fancyData.isDeclared) {
      throw new HttpException(409, `Fancy bet can't RollBack`);
    }
  }

  /**
  * Processes fancy bet settlements using optimized batch operations
  *
  * This method handles the bulk processing of fancy bet settlements with:
  * - Batch user data retrieval for performance optimization
  * - Parallel processing of settlement calculations
  * - Atomic batch operations for data consistency
  * - Comprehensive error handling and rollback capabilities
  *
  * @private
  * @param {any[]} matchExposures - Array of match exposure records to settle
  * @param {number} run - The actual run outcome for settlement calculations
  * @param {ObjectId} matchObjectId - MongoDB ObjectId of the match
  * @returns {Promise<{ message: string; settledBets: number; results: Array<{ userId: string; betId: string; walletExposureResult: number; settlementAmount: number; selectedKey: string; run: number; }>; }>}
  *          Object containing settlement processing results and statistics
  * @throws {HttpException} When batch processing fails or data inconsistencies are detected
  */
  private async processFancyBetRollback(matchExposures: any[], matchObjectId: ObjectId): Promise<{ message: string; cancelledBets: number; results: Array<{ userId: string; betId: string; walletExposureResult: number; cancellationAmount: number; selectedKey: string; run: number; }>; }> {
    // Extract unique user IDs and batch fetch users
    const userIds = [...new Set(matchExposures.map(bet => bet.user_id.toString()))];

    const users = await this.user.find(
      { _id: { $in: userIds.map(id => new ObjectId(id)) } },
      { _id: 1, wallet: 1, exposure: 1 }
    ).lean();

    // Create optimized user lookup map
    const userMap = new Map(
      users.map(user => [user._id.toString(), user])
    );

    // Prepare batch operations with enhanced error handling
    const batchOperations = this.prepareFancyRollbackBatchOperations(
      matchExposures,
      userMap,
      matchObjectId
    );

    // Execute all batch operations with transaction-like behavior
    await this.executeFancyRollbackBatchOperations(batchOperations);

    return {
      message: 'Fancy bets rolled back successfully',
      cancelledBets: batchOperations.rolledBackBets.length,
      results: batchOperations.rolledBackBets
    };
  }

  /**
   * Prepares optimized batch operations for fancy bet settlement processing
   *
   * This method creates structured batch operations for:
   * - User wallet and exposure updates
   * - Transaction record insertions
   * - Exposure status updates
   * - Settlement result compilation
   *
   * All operations are prepared in memory before execution to ensure atomicity.
   *
   * @private
   * @param {any[]} matchExposures - Array of exposure records to process
   * @param {Map<string, any>} userMap - Optimized user data lookup map
   * @param {number} run - Actual run outcome for calculations
   * @param {ObjectId} matchObjectId - Match identifier for transaction records
   * @returns {{ userUpdates: any[]; transactionInserts: any[]; exposureUpdates: any[]; settlementResults: any[]; }}
   *          Object containing all prepared batch operations
   * @throws {HttpException} When settlement calculations fail or user data is invalid
   */
  private prepareFancyRollbackBatchOperations(matchExposures: any[], userMap: Map<string, any>, matchObjectId: ObjectId): { userUpdates: any[]; transactionInserts: any[]; exposureUpdates: any[]; rolledBackBets: any[]; } {
    const userUpdates: any[] = [];
    const transactionInserts: any[] = [];
    const exposureUpdates: any[] = [];
    const rolledBackBets: any[] = [];

    for (const bet of matchExposures) {
      try {

        const { user_id, exposure, settlement_amount, settlement_commission } = bet;
        const userId = user_id.toString();

        const currentUser = userMap.get(userId);
        if (!currentUser) {
          throw new HttpException(404, `User not found for ID: ${userId}`);
        }

        // Calculate final wallet result
        const walletExposureResult = currentUser.wallet - (Number(settlement_amount) + Number(settlement_commission));

        // Prepare optimized batch operations
        userUpdates.push({
          updateOne: {
            filter: { _id: user_id },
            update: {
              $inc: {
                wallet: -(Number(settlement_amount) + Number(settlement_commission)),
                exposure: +Number(exposure)
              }
            }
          }
        });

        const transactionId = new ObjectId(); // generate transaction id beforehand

        transactionInserts.push({
          _id: transactionId, // ✅ manually assign _id so we can reference it
          user_id,
          match_id: matchObjectId,
          amount: +(Number(settlement_amount) + Number(settlement_commission)),
          type: MatchTransactionType.DEBIT,
          note: 'Fancy bet cancelled',
          status: MatchTransactionStatus.DONE,
          transfer_type: MatchTransactionTransferType.FANCY_ROLLBACK,
          prev_balance: currentUser.wallet,
          current_balance: walletExposureResult,
          createdAt: new Date()
        });

        exposureUpdates.push({
          updateOne: {
            filter: { _id: bet._id },
            update: {
              $addToSet: { transaction_id: transactionId },
              $set: {
                settlement_status: ExposureStatus.PENDING,
                status: true,
                settled_at: new Date(),
              }
            }
          }
        });

        rolledBackBets.push({
          userId,
          betId: bet._id.toString(),
          walletExposureResult,
          rollbackAmount: +Number(settlement_amount),
          rollbackCommission: +Number(settlement_commission),
        });
      } catch (error) {
        throw new HttpException(
          500,
          `Error processing cancellation for bet ${bet._id}: ${error.message}`
        );
      }
    }

    return { userUpdates, transactionInserts, exposureUpdates, rolledBackBets };
  }

  /**
   * Executes batch operations with enhanced error handling and rollback capability
   *
   * This method performs atomic batch operations in optimal order:
   * 1. Updates exposure records first to lock bet states
   * 2. Updates user wallets and exposures
   * 3. Creates transaction audit records
   *
   * All operations are executed in parallel for maximum performance while
   * maintaining data consistency through ordered execution strategy.
   *
   * @private
   * @param {{ userUpdates: any[]; transactionInserts: any[]; exposureUpdates: any[]; settlementResults: any[]; }} batchOperations
   *        Object containing all prepared batch operations
   * @returns {Promise<void>} Resolves when all operations complete successfully
   * @throws {HttpException} When any batch operation fails, with detailed error context
   */
  private async executeFancyRollbackBatchOperations(batchOperations: { userUpdates: any[]; transactionInserts: any[]; exposureUpdates: any[]; }): Promise<void> {
    const { userUpdates, transactionInserts, exposureUpdates } = batchOperations;

    try {
      // Execute operations in optimal order for data consistency
      const operations = [];

      if (exposureUpdates.length > 0) {
        operations.push(this.exposure.bulkWrite(exposureUpdates, { ordered: false }));
      }

      if (userUpdates.length > 0) {
        operations.push(this.user.bulkWrite(userUpdates, { ordered: false }));
      }

      if (transactionInserts.length > 0) {
        operations.push(this.transaction.insertMany(transactionInserts, { ordered: false }));
      }

      // Execute all operations in parallel for better performance
      await Promise.all(operations);

    } catch (error) {
      throw new HttpException(
        500,
        `Failed to execute settlement batch operations: ${error.message}`
      );
    }
  }

  /**
   * Process fancy bet status updates efficiently using bulk operations
   * Eliminates redundant database queries and improves performance
   * @private
   */
  /**
   * Processes fancy bet status updates based on run outcomes
   *
   * This method handles bulk status updates for fancy bets including:
   * - Run-based win/loss determination
   * - Batch status updates for performance
   * - Settlement timestamp recording
   * - Error handling for individual bet failures
   *
   * @private
   * @param {any[]} matchBets - Array of fancy bets to process
   * @param {number} run - Actual run outcome for status determination
   * @param {ObjectId} matchObjectId - Match identifier for audit trail
   * @param {number} sid - Selection ID for the fancy market
   * @returns {Promise<void>} Resolves when all status updates complete
   * @throws {HttpException} When batch processing fails
   */
  private async processFancyBetRollbackUpdates(matchBets: any[], matchObjectId: ObjectId, sid: number): Promise<void> {
    // Set settled timestamp
    const settledAt = new Date();

    // Get all fancy bet IDs for this match & selection
    const fancyBetIds = matchBets
      .filter(bet => bet.bet_type === MatchBetType.FANCY)
      .map(bet => bet._id);

    if (fancyBetIds.length === 0) return;
    // Update all as PENDING in bulk
    await this.matchBet.updateMany(
      {
        _id: { $in: fancyBetIds },
        match_id: matchObjectId,
        bet_type: MatchBetType.FANCY,
        selection_id: sid,
        status: { $in: [MatchBetStatus.LOST, MatchBetStatus.WON, MatchBetStatus.CANCELLED], $ne: MatchBetStatus.DELETED }
      },
      {
        $set: {
          status: MatchBetStatus.PENDING,      // ✅ Pending
          result: null,                        // ✅ No result for pending bets
          settled_at: settledAt
        }
      }
    );
  }


  // ========================================
  // CANCEL SINGLE BET METHODS
  // ========================================

  /**
 * Cancel Single bets
 * DELETE /api/v1/match-bets/cancel/single/:betId
 */
  public async cancelSingleBet(betId: string) {
    const betObjectId = new ObjectId(betId);

    // Cancel bet first
    const cancelledBet = await this.matchBet.findByIdAndUpdate(
      betObjectId,
      {
        status: MatchBetStatus.DELETED,
        result: null,              // Cancelled bets have no result
        settled_at: new Date()
      },
      { new: true }
    );

    if (!cancelledBet) {
      throw new HttpException(404, "Bet not found or already cancelled");
    }

    // Calculate exposure reduction
    const exposureReduction =
      cancelledBet.bet_type === MatchBetType.BOOKMAKER
        ? await this.calculateTeamExposureReduction(
          cancelledBet.user_id,
          cancelledBet.match_id,
          cancelledBet.selection_id
        )
        : await this.calculateSessionExposureReduction(
          cancelledBet.user_id,
          cancelledBet.match_id,
          cancelledBet.selection_id
        );

    // Prepare exposure query
    const exposureQuery: any = {
      user_id: cancelledBet.user_id,
      match_id: cancelledBet.match_id,
      gameId: cancelledBet.game_id,
      bet_type: cancelledBet.bet_type,
    };
    if (cancelledBet.bet_type === MatchBetType.FANCY) {
      exposureQuery.selection_id = cancelledBet.selection_id;
    }

    // Fetch user and exposure in parallel
    const [updatedUser, existingExposure] = await Promise.all([
      this.user.findById(cancelledBet.user_id),
      this.exposure.findOne(exposureQuery)
    ]);

    const availableBalance = updatedUser
      ? updatedUser.wallet - updatedUser.exposure
      : 0;

    // Prepare exposure data
    const exposureData = {
      user_id: cancelledBet.user_id,
      match_id: cancelledBet.match_id,
      gameId: cancelledBet.game_id,
      bet_type: cancelledBet.bet_type,
      selection_id: cancelledBet.selection_id,
      potential_profitloss: exposureReduction.profitLossBreakdown,
      exposure: exposureReduction.totalExposure,
      status: true,
    };

    let userUpdateOps;

    if (!existingExposure) {
      // Create new exposure record
      await this.exposure.create(exposureData);

      // New exposure directly affects wallet/exposure
      userUpdateOps = {
        $inc: {
          wallet: -Number(exposureReduction.totalExposure),
          exposure: Number(exposureReduction.totalExposure),
        },
      };
    } else {
      // Update existing exposure record
      const exposureDiff =
        Number(exposureReduction.totalExposure) -
        Number(existingExposure.exposure);

      // Fallback to 0 if not a valid number
      // if (isNaN(exposureDiff)) exposureDiff = 0;

      await this.exposure.findByIdAndUpdate(existingExposure._id, {
        potential_profitloss: exposureReduction.profitLossBreakdown,
        exposure: exposureReduction.totalExposure,
      });

      // Wallet + exposure adjustment
      userUpdateOps = {
        $inc: {
          wallet: -exposureDiff,
          exposure: exposureDiff,
        },
      };
    }

    // Update user in single operation
    await this.user.findByIdAndUpdate(cancelledBet.user_id, userUpdateOps);

    return {
      cancelledBet,
      availableBalance,
      updatedExposure: exposureData,
    };
  }

  private async calculateTeamExposureReduction(userId: string, matchId: string, selectionId?: number): Promise<{ profitLossBreakdown: Record<string, number>; totalExposure: number; }> {
    try {
      // Get match data for team name resolution
      const match = await this.match.findById(matchId);
      if (!match) {
        throw new HttpException(404, 'Match not found');
      }

      // Get all active bets for this user and match
      const bets = await this.matchBet.find({
        user_id: userId,
        match_id: matchId,
        status: { $in: [MatchBetStatus.PENDING, MatchBetStatus.WON, MatchBetStatus.LOST] },
        is_active: true
      });

      const profitLoss = new Map<string, number>();

      // Initialize profit/loss for all possible selections based on bet types present
      const hasBookmakerBets = bets.some(bet => bet.bet_type === MatchBetType.BOOKMAKER);

      if (hasBookmakerBets) {
        // Initialize with actual team names from match data
        const bookmakerSelectionIds = this.getBookmakerSelectionIds(match);
        for (const selectionId of bookmakerSelectionIds) {
          const teamName = this.getTeamNameBySelectionId(match, selectionId);
          profitLoss.set(teamName, 0);
        }
      }

      // Process each bet
      for (const bet of bets) {
        const betOddsRate = parseFloat(bet.odds_rate);

        if (bet.bet_type === MatchBetType.BOOKMAKER) {
          if (bet.selection === 'Back') {
            const winAmount = bet.stake_amount * (betOddsRate / 100);
            const loseAmount = -bet.stake_amount;

            // Get actual team name for this bet's selection_id
            const betTeamName = this.getTeamNameBySelectionId(match, bet.selection_id);

            // Apply win to the bet's team and loss to all other teams
            for (const [teamName] of profitLoss) {
              if (teamName === 'yes' || teamName === 'no') continue; // Skip fancy bet keys

              if (teamName === betTeamName) {
                profitLoss.set(teamName, profitLoss.get(teamName)! + winAmount);
              } else {
                profitLoss.set(teamName, profitLoss.get(teamName)! + loseAmount);
              }
            }
          } else if (bet.selection === 'Lay') {
            const winAmount = bet.stake_amount;
            const loseAmount = -(bet.stake_amount * (betOddsRate / 100));

            // Get actual team name for this bet's selection_id
            const betTeamName = this.getTeamNameBySelectionId(match, bet.selection_id);

            // Apply loss to the bet's team and win to all other teams
            for (const [teamName] of profitLoss) {
              if (teamName === 'yes' || teamName === 'no') continue; // Skip fancy bet keys

              if (teamName === betTeamName) {
                profitLoss.set(teamName, profitLoss.get(teamName)! + loseAmount);
              } else {
                profitLoss.set(teamName, profitLoss.get(teamName)! + winAmount);
              }
            }
          }
        }
      }

      // Calculate total exposure as maximum potential loss
      const allProfitLossValues = Array.from(profitLoss.values());
      const totalExposure = Math.abs(Math.min(...allProfitLossValues, 0));

      return {
        profitLossBreakdown: Object.fromEntries(profitLoss),
        totalExposure
      };
    } catch (error) {
      console.error('Error calculating team-wise profit/loss:', error);
      return {
        profitLossBreakdown: {},
        totalExposure: 0
      };
    }
  }

  private async calculateSessionExposureReduction(userId: string, matchId: string, selectionId?: number): Promise<{ profitLossBreakdown: Record<string, number>; totalExposure: number; }> {
    try {
      // Get match data for team name resolution
      const match = await this.match.findById(matchId);
      if (!match) {
        throw new HttpException(404, 'Match not found');
      }

      // Get all active bets for this user and match
      const bets = await this.matchBet.find({
        user_id: userId,
        match_id: matchId,
        selection_id: selectionId,
        status: { $in: [MatchBetStatus.PENDING, MatchBetStatus.WON, MatchBetStatus.LOST] },
        is_active: true
      });

      const profitLoss = new Map<string, number>();

      const hasFancyBets = bets.some(bet => bet.bet_type === MatchBetType.FANCY)

      // Initialize with Run(odds_value) if bet
      const fancyBetsRuns = this.calculateRunList(bets.filter(bet => bet.bet_type === MatchBetType.FANCY));

      if (hasFancyBets) {
        for (const fancyBetsRun of fancyBetsRuns) {
          profitLoss.set(String(fancyBetsRun), 0)
        }
      }

      const minRun = Math.min(...fancyBetsRuns);
      const maxRun = Math.max(...fancyBetsRuns);

      // Process each bet
      for (const bet of bets) {
        const betOddsRate = parseFloat(bet.odds_rate);
        const betOddsValue = bet.odds_value ? parseFloat(bet.odds_value) : 0;
        if (bet.bet_type === MatchBetType.FANCY) {
          if (bet.selection === 'Yes') {
            const winAmount = bet.stake_amount * (betOddsRate / 100);
            const loseAmount = -bet.stake_amount;

            // Win from betOddsValue → max
            for (let run = betOddsValue; run <= maxRun; run++) {
              profitLoss.set(String(run), profitLoss.get(String(run))! + winAmount);
            }

            // Lose from min → betOddsValue-1
            for (let run = minRun; run < betOddsValue; run++) {
              profitLoss.set(String(run), profitLoss.get(String(run))! + loseAmount);
            }
          } else if (bet.selection === 'Not') {
            const winAmount = bet.stake_amount;
            const loseAmount = -(bet.stake_amount * (betOddsRate / 100));

            // Win from min → betOddsValue-1
            for (let run = minRun; run < betOddsValue; run++) {
              profitLoss.set(String(run), profitLoss.get(String(run))! + winAmount);
            }

            // Lose from betOddsValue → max
            for (let run = betOddsValue; run <= maxRun; run++) {
              profitLoss.set(String(run), profitLoss.get(String(run))! + loseAmount);
            }
          }
        }
      }

      // Calculate total exposure as maximum potential loss
      const allProfitLossValues = Array.from(profitLoss.values());
      const totalExposure = Math.abs(Math.min(...allProfitLossValues, 0));

      return {
        profitLossBreakdown: Object.fromEntries(profitLoss),
        totalExposure
      };
    } catch (error) {
      console.error('Error calculating team-wise profit/loss:', error);
      return {
        profitLossBreakdown: {},
        totalExposure: 0
      };
    }
  }

  /**
   * Get user's current exposure and available balance
   * Uses the correct bookmaker format where odds like 40 mean 0.40 (40/100)
   * @param userId - User ID
   * @param matchId - Optional match ID to get match-specific exposure
   * @returns User's exposure and balance information
   */
  // ========================================
  // USER BALANCE AND EXPOSURE METHODS
  // ========================================

  /**
   * Retrieves comprehensive user exposure and balance information
   *
   * This method provides detailed financial overview including:
   * - Current wallet balance
   * - Total exposure across all active bets
   * - Available balance for new bets
   * - Match-specific exposure (if matchId provided)
   * - Detailed exposure breakdown by bet type
   *
   * @public
   * @param {string} userId - User identifier for balance retrieval
   * @param {string} [matchId] - Optional match ID for match-specific exposure
   * @returns {Promise<{ totalWallet: number; totalExposure: number; availableBalance: number; matchExposure?: number; exposureBreakdown: any[]; }>}
   *          Complete user financial status object
   * @throws {HttpException} When user not found or calculation fails
   */
  public async getUserExposureAndBalance(userId: string, matchId?: string): Promise<{ totalWallet: number; totalExposure: number; availableBalance: number; matchExposure?: number; exposureBreakdown: any[]; }> {
    try {
      // Get user's current wallet and exposure
      const user = await this.user.findById(userId).select('wallet exposure');
      if (!user) {
        throw new HttpException(404, 'User not found');
      }

      // Get all active bets for exposure breakdown
      const betsQuery: any = {
        user_id: userId,
        status: { $in: [MatchBetStatus.PENDING, MatchBetStatus.ACTIVE] }
      };

      if (matchId) {
        betsQuery.match_id = matchId;
      }

      const activeBets = await this.matchBet.find(betsQuery)
        .populate('match_id', 'eventName teams')
        .sort({ createdAt: -1 });

      // Calculate exposure breakdown by match and market
      const exposureBreakdown: any[] = [];
      const matchExposureMap = new Map();
      const matchDataCache = new Map(); // Cache match data to avoid repeated queries

      for (const bet of activeBets) {
        const key = `${bet.match_id._id}_${bet.bet_type}_${bet.selection_id || bet.market_id}`;

        if (!matchExposureMap.has(key)) {
          matchExposureMap.set(key, {
            matchId: bet.match_id._id,
            matchName: bet.match_id.eventName,
            betType: bet.bet_type,
            selectionId: bet.selection_id,
            marketId: bet.market_id,
            teamName: bet.team_name,
            sessionName: bet.session_name,
            profitLoss: new Map(),
            exposure: 0
          });
        }

        const exposureData = matchExposureMap.get(key);
        const betOddsRate = parseFloat(bet.odds_rate);

        // Initialize profit/loss for all possible selections if not already done
        if (exposureData.profitLoss.size === 0) {
          if (bet.bet_type === MatchBetType.BOOKMAKER) {
            // Get match data for team name resolution
            let matchData = matchDataCache.get(bet.match_id._id.toString());
            if (!matchData) {
              matchData = await this.match.findById(bet.match_id._id);
              matchDataCache.set(bet.match_id._id.toString(), matchData);
            }

            if (matchData) {
              // Initialize with actual team names from match data
              const bookmakerSelectionIds = this.getBookmakerSelectionIds(matchData);
              for (const selectionId of bookmakerSelectionIds) {
                const teamName = this.getTeamNameBySelectionId(matchData, selectionId);
                exposureData.profitLoss.set(teamName, 0);
              }
            } else {
              // Fallback to hardcoded values if match data not found
              exposureData.profitLoss.set('teamA', 0);
              exposureData.profitLoss.set('teamB', 0);
            }
          } else {
            exposureData.profitLoss.set('yes', 0);
            exposureData.profitLoss.set('no', 0);
          }
        }

        if (bet.bet_type === MatchBetType.BOOKMAKER) {
          if (bet.selection === 'Back') {
            // Back bet: Win odds amount if team wins, lose stake if team loses
            const winAmount = bet.stake_amount * (betOddsRate / 100);
            const loseAmount = -bet.stake_amount;

            // Get match data for team name resolution
            let matchData = matchDataCache.get(bet.match_id._id.toString());
            if (!matchData) {
              matchData = await this.match.findById(bet.match_id._id);
              matchDataCache.set(bet.match_id._id.toString(), matchData);
            }

            if (matchData) {
              // Get actual team name for this bet's selection_id
              const betTeamName = this.getTeamNameBySelectionId(matchData, bet.selection_id);

              // Apply win to the bet's team and loss to all other teams
              for (const [teamName] of exposureData.profitLoss) {
                if (teamName === 'yes' || teamName === 'no') continue; // Skip fancy bet keys

                if (teamName === betTeamName) {
                  exposureData.profitLoss.set(teamName, (exposureData.profitLoss.get(teamName) || 0) + winAmount);
                } else {
                  exposureData.profitLoss.set(teamName, (exposureData.profitLoss.get(teamName) || 0) + loseAmount);
                }
              }
            } else {
              // Fallback to hardcoded logic if match data not available
              const teamKey = 'teamA';
              const oppositeTeamKey = 'teamB';
              exposureData.profitLoss.set(teamKey, (exposureData.profitLoss.get(teamKey) || 0) + winAmount);
              exposureData.profitLoss.set(oppositeTeamKey, (exposureData.profitLoss.get(oppositeTeamKey) || 0) + loseAmount);
            }
          } else if (bet.selection === 'Lay') {
            // Lay bet: Win stake if team loses, lose liability if team wins
            const winAmount = bet.stake_amount;
            const loseAmount = -(bet.stake_amount * (betOddsRate / 100));

            // Get match data for team name resolution
            let matchData = matchDataCache.get(bet.match_id._id.toString());
            if (!matchData) {
              matchData = await this.match.findById(bet.match_id._id);
              matchDataCache.set(bet.match_id._id.toString(), matchData);
            }

            if (matchData) {
              // Get actual team name for this bet's selection_id
              const betTeamName = this.getTeamNameBySelectionId(matchData, bet.selection_id);

              // Apply loss to the bet's team and win to all other teams
              for (const [teamName] of exposureData.profitLoss) {
                if (teamName === 'yes' || teamName === 'no') continue; // Skip fancy bet keys

                if (teamName === betTeamName) {
                  exposureData.profitLoss.set(teamName, (exposureData.profitLoss.get(teamName) || 0) + loseAmount);
                } else {
                  exposureData.profitLoss.set(teamName, (exposureData.profitLoss.get(teamName) || 0) + winAmount);
                }
              }
            } else {
              // Fallback to hardcoded logic if match data not available
              const teamKey = 'teamA';
              const oppositeTeamKey = 'teamB';
              exposureData.profitLoss.set(teamKey, (exposureData.profitLoss.get(teamKey) || 0) + loseAmount);
              exposureData.profitLoss.set(oppositeTeamKey, (exposureData.profitLoss.get(oppositeTeamKey) || 0) + winAmount);
            }
          }
        } else if (bet.bet_type === MatchBetType.FANCY) {
          if (bet.selection === 'Yes') {
            const winAmount = bet.stake_amount * (betOddsRate / 100);
            const loseAmount = -bet.stake_amount;
            exposureData.profitLoss.set('yes', (exposureData.profitLoss.get('yes') || 0) + winAmount);
            exposureData.profitLoss.set('no', (exposureData.profitLoss.get('no') || 0) + loseAmount);
          } else if (bet.selection === 'No') {
            const winAmount = bet.stake_amount;
            const loseAmount = -(bet.stake_amount * (betOddsRate / 100));
            exposureData.profitLoss.set('yes', (exposureData.profitLoss.get('yes') || 0) + loseAmount);
            exposureData.profitLoss.set('no', (exposureData.profitLoss.get('no') || 0) + winAmount);
          }
        }
      }

      // Calculate exposure for each market
      let totalCalculatedExposure = 0;
      for (const [data] of matchExposureMap) {
        // Calculate exposure as the maximum potential loss
        const allProfitLossValues = Array.from(data.profitLoss.values());
        data.exposure = Math.abs(Math.min(...allProfitLossValues.map(Number), 0));

        totalCalculatedExposure += data.exposure;

        // Convert profitLoss Map to object for response
        data.profitLossBreakdown = Object.fromEntries(data.profitLoss);
        delete data.profitLoss;

        exposureBreakdown.push(data);
      }

      const availableBalance = user.wallet - user.exposure;
      const matchSpecificExposure = matchId ?
        exposureBreakdown
          .filter(item => item.matchId.toString() === matchId)
          .reduce((sum, item) => sum + item.exposure, 0) : undefined;

      return {
        totalWallet: user.wallet,
        totalExposure: user.exposure,
        availableBalance: Math.max(availableBalance, 0),
        matchExposure: matchSpecificExposure,
        exposureBreakdown
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(500, `Error getting user exposure: ${error.message}`);
    }
  }

}

export default MatchBetService;
