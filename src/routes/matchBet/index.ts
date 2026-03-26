// matchBet/index.ts

import { Router } from 'express';
import MatchBetController from '@/controllers/matchBet';
import ValidationMiddleware from '@/middlewares/validation.middleware';
import { CreateMatchBetDto, SettleBetDto, SettleFancyBetDto, CancelFancyBetDto } from '@/dtos/matchBet.dto';
import authMiddleware from '@/middlewares/auth.middleware';


class MatchBetRoute {
  public path = '/api/v1/match-bets';
  public router = Router();
  public matchBetController = new MatchBetController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Create new match bet
    this.router.post(
      `${this.path}/create`,
      authMiddleware,
      ValidationMiddleware(CreateMatchBetDto, 'body'),
      this.matchBetController.createMatchBet,
    );

    // Get all match bets with filters (pagination, sorting, etc.)
    this.router.get(`${this.path}`, this.matchBetController.getAllMatchBets);

    // Get match bets for a specific user
    this.router.get(`${this.path}/user/:userId`, this.matchBetController.getMatchBetsByUserId);

    // Get match bets for a specific match
    this.router.get(`${this.path}/match/:matchId`, this.matchBetController.getMatchBetsByMatchId);

    // Get match bets for a specific match and user
    this.router.get(`${this.path}/match/:matchId/user/:userId`, this.matchBetController.getMatchBetsByMatchIdAndUserId);

    // Get match bets for a specific match and user
    this.router.get(`${this.path}/match/:matchId/admin/:adminId`, this.matchBetController.getMatchBetsByMatchIdAndAdminId);

    // Get bookmaker bets for a specific match
    this.router.get(`${this.path}/match/:matchId/bookmaker`, this.matchBetController.getBookmakerBetsByMatchId);

    // Get fancy bets for a specific match
    this.router.get(`${this.path}/match/:matchId/fancy`, this.matchBetController.getFancyBetsByMatchId);

    // Get user's exposure and balance information
    this.router.get(`${this.path}/user/:userId/exposure`, this.matchBetController.getUserExposureAndBalance);

    // Get user's teamwise exposure and balance
    this.router.get(`${this.path}/user/:userId/match/:matchId`, this.matchBetController.getUserTeamwiseExposureAndBalance);

    // Settle bookmaker bets
    this.router.post(`${this.path}/settle/bookmacker/:matchId`, ValidationMiddleware(SettleBetDto, 'body'), this.matchBetController.settleBookMackerBets);

    // Cancel bookmaker bets
    this.router.post(`${this.path}/cancel/bookmacker/:matchId`, this.matchBetController.cancelBookMackerBets);

    // Rollback bookmaker bets
    this.router.post(`${this.path}/rollback/bookmacker/:matchId`, this.matchBetController.rollbackBookmakerBets);

    // Settle fancy bets
    this.router.post(`${this.path}/settle/fancy/:matchId`, ValidationMiddleware(SettleFancyBetDto, 'body'), this.matchBetController.settleFancyBets);

    // Cancel fancy bets
    this.router.post(`${this.path}/cancel/fancy/:matchId`, ValidationMiddleware(CancelFancyBetDto, 'body'), this.matchBetController.cancelFancyBets);

    // Rollback fancy bets
    this.router.post(`${this.path}/rollback/fancy/:matchId`, ValidationMiddleware(CancelFancyBetDto, 'body'), this.matchBetController.rollbackFancyBets);

    // Cancel Single bets
    this.router.delete(`${this.path}/cancel/single/:betId`, this.matchBetController.cancelSingleBet);

    this.router.get(`${this.path}/cancel/single/:betId`, this.matchBetController.showCancelledSingleBet);

    // Get current user's exposure and balance (requires authentication)
    this.router.get(`${this.path}/my-exposure`, authMiddleware, this.matchBetController.getMyExposureAndBalance);

    // Get specific bet by ID (must be last to avoid conflicts with other routes)
    this.router.get(`${this.path}/:betId`, this.matchBetController.getBetById);
  }
}

export default MatchBetRoute;
