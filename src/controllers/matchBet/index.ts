// matchBet/index.ts

import { Request, Response, NextFunction } from 'express';
import MatchBetService from '@/services/matchBet.service';
import { CreateMatchBetDto, SettleBetDto, SettleFancyBetDto, CancelFancyBetDto } from '@/dtos/matchBet.dto';
import { MatchBetType } from '@/interfaces/matchBet.interface';
import { RequestWithUser } from '@/interfaces/auth.interface';

/**
 * Controller for match betting operations
 */
class MatchBetController {
  public matchBetService: MatchBetService;

  constructor() {
    this.matchBetService = new MatchBetService();
  }

  /**
   * Create a new match bet
   * POST /api/v1/match-bets/create
   */
  public createMatchBet = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const betData: CreateMatchBetDto = req.body;
      const authedUserId = req.user?._id?.toString?.() ?? (req.user as any)?.id?.toString?.();

      if (!authedUserId) {
        return res.status(401).json({
          status: "error",
          message: "User not authenticated",
        });
      }

      // Never trust client-provided user_id. Enforce token user.
      if (betData.user_id && betData.user_id.toString() !== authedUserId) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden: user_id mismatch",
        });
      }
      betData.user_id = authedUserId;

      // Additional validation for bet type specific fields
      if (betData.bet_type === MatchBetType.BOOKMAKER) {
        if (!betData.selection_id) {
          return res.status(400).json({
            status: "error",
            message: "selection_id is required for BOOKMAKER bets"
          });
        }

        if (!['Back', 'Lay'].includes(betData.selection)) {
          return res.status(400).json({
            status: "error",
            message: "selection must be 'Back' or 'Lay' for BOOKMAKER bets"
          });
        }
      }

      if (betData.bet_type === MatchBetType.FANCY) {
        if (!betData.market_id) {
          return res.status(400).json({
            status: "error",
            message: "market_id is required for FANCY bets"
          });
        }

        if (!['Yes', 'Not'].includes(betData.selection)) {
          return res.status(400).json({
            status: "error",
            message: "selection must be 'Yes' or 'Not' for FANCY bets"
          });
        }
      }

      const bet = await this.matchBetService.createMatchBet(betData);

      res.status(201).json({
        status: "success",
        message: "Match bet created successfully",
        data: bet
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all match bets with filters
   * GET /api/v1/match-bets
   */
  public getAllMatchBets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queryData = req.query as any;
      const result = await this.matchBetService.getAllMatchBets(queryData);

      res.status(200).json({
        status: "success",
        message: "Match bets fetched successfully",
        data: result.bets,
        total: result.total,
        count: result.bets.length
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get match bets by match ID
   * GET /api/v1/match-bets/match/:matchId
   */
  public getMatchBetsByMatchId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = req.params.matchId;
      const queryData = {
        match_id: matchId,
        ...req.query
      } as any;

      const result = await this.matchBetService.getAllMatchBets(queryData);

      res.status(200).json({
        status: "success",
        message: "Match bets fetched successfully",
        data: result.bets,
        total: result.total,
        count: result.bets.length
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get match bets by user ID
   * GET /api/v1/match-bets/user/:userId
   */
  public getMatchBetsByUserId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId;
      const queryData = {
        user_id: userId,
        ...req.query
      } as any;

      const result = await this.matchBetService.getAllMatchBets(queryData);

      res.status(200).json({
        status: "success",
        message: "User match bets fetched successfully",
        data: result.bets,
        total: result.total,
        count: result.bets.length
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get match bets by match ID and user ID
   * GET /api/v1/match-bets/match/:matchId/user/:userId
   */
  public getMatchBetsByMatchIdAndUserId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = req.params.matchId;
      const userId = req.params.userId;

      const queryData = {
        match_id: matchId,
        user_id: userId,
        ...req.query
      } as any;

      const result = await this.matchBetService.getAllMatchBets(queryData);

      res.status(200).json({
        status: "success",
        message: "User match bets for match fetched successfully",
        data: result.bets,
        total: result.total,
        count: result.bets.length
      });
    } catch (error) {
      next(error);
    }
  };

    /**
   * Get match bets by match ID and user ID
   * GET /api/v1/match-bets/match/:matchId/user/:userId
   */
  public getMatchBetsByMatchIdAndAdminId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = req.params.matchId;
      const adminId = req.params.adminId;

      const queryData = {
        match_id: matchId,
        admin_id: adminId,
        ...req.query
      } as any;

      const result = await this.matchBetService.getAllAdminMatchBets(queryData);

      res.status(200).json({
        status: "success",
        message: "Admin match bets for match fetched successfully",
        data: result.bets,
        total: result.total,
        count: result.bets.length
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get BOOKMAKER bets for a match
   * GET /api/v1/match-bets/match/:matchId/bookmaker
   */
  public getBookmakerBetsByMatchId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = req.params.matchId;
      const queryData = {
        match_id: matchId,
        bet_type: MatchBetType.BOOKMAKER,
        ...req.query
      } as any;

      const result = await this.matchBetService.getAllMatchBets(queryData);

      res.status(200).json({
        status: "success",
        message: "Bookmaker bets fetched successfully",
        data: result.bets,
        total: result.total,
        count: result.bets.length
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get FANCY bets for a match
   * GET /api/v1/match-bets/match/:matchId/fancy
   */
  public getFancyBetsByMatchId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = req.params.matchId;
      const queryData = {
        match_id: matchId,
        bet_type: MatchBetType.FANCY,
        ...req.query
      } as any;

      const result = await this.matchBetService.getAllMatchBets(queryData);

      res.status(200).json({
        status: "success",
        message: "Fancy bets fetched successfully",
        data: result.bets,
        total: result.total,
        count: result.bets.length
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get bet by ID
   * GET /api/v1/match-bets/:betId
   */
  public getBetById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const betId = req.params.betId;
      const queryData = { _id: betId };

      const result = await this.matchBetService.getAllMatchBets(queryData);

      if (result.bets.length === 0) {
        return res.status(404).json({
          status: "error",
          message: "Bet not found"
        });
      }

      res.status(200).json({
        status: "success",
        message: "Bet fetched successfully",
        data: result.bets[0]
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user's exposure and balance information
   * GET /api/v1/match-bets/user/:userId/exposure
   * GET /api/v1/match-bets/user/:userId/exposure?matchId=:matchId
   */
  public getUserExposureAndBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId;
      const matchId = req.query.matchId as string;

      const exposureData = await this.matchBetService.getUserExposureAndBalance(userId, matchId);

      res.status(200).json({
        status: "success",
        message: "User exposure and balance fetched successfully",
        data: {
          userId,
          matchId: matchId || null,
          wallet: {
            total: exposureData.totalWallet,
            available: exposureData.availableBalance,
            exposure: exposureData.totalExposure
          },
          matchExposure: exposureData.matchExposure,
          exposureBreakdown: exposureData.exposureBreakdown
        }
      });
    } catch (error) {
      next(error);
    }
  };

  public getUserTeamwiseExposureAndBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId;
      const matchId = req.params.matchId;

      const profitlossData = await this.matchBetService.calculateTeamWiseProfitLoss(userId, matchId);

      res.status(200).json({
        status: "success",
        message: "User teamwise profit and loss fetched successfully",
        data: {
          userId,
          matchId,
          profitLossBreakdown: profitlossData.profitLossBreakdown,
          totalExposure: profitlossData.totalExposure,
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Settle bookmaker bets
   * POST /api/v1/match-bets/settle/bookmacker/:matchId
   */
  public settleBookMackerBets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = req.params.matchId;
      const { sid, team }: SettleBetDto = req.body;

      const settledBet = await this.matchBetService.settleBookMackerBets(matchId, sid, team);

      res.status(200).json({
        status: "success",
        data: settledBet
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel bookmaker bets
   * POST /api/v1/match-bets/cancel/bookmacker/:matchId
   */
  public cancelBookMackerBets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = req.params.matchId;
      const cancelledBet = await this.matchBetService.cancelBookMackerBets(matchId);

      res.status(200).json({
        status: "success",
        message: "Bookmaker bets cancelled successfully",
        data: cancelledBet
      });
    } catch (error) {
      next(error);
    }
  }

    /**
   * Rollback bookmaker bets
   * POST /api/v1/match-bets/rollback/bookmaker/:matchId
   */
  public rollbackBookmakerBets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = req.params.matchId;
      const rollbackBet = await this.matchBetService.rollbackBookMackerBets(matchId);

      res.status(200).json({
        status: "success",
        message: "Bookmaker bets rolled back successfully",
        data: rollbackBet
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Settle fancy bets
   * POST /api/v1/match-bets/settle/fancy/:matchId
   */
  public settleFancyBets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = req.params.matchId;
      const { sid, run, fancyId }: SettleFancyBetDto = req.body;

      const settledBet = await this.matchBetService.settleFancyBets(matchId, sid, run, fancyId);

      res.status(200).json({
        status: "success",
        data: settledBet
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel fancy bets
   * POST /api/v1/match-bets/cancel/fancy/:matchId
   */
  public cancelFancyBets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = req.params.matchId;
      const { sid, fancyId }: CancelFancyBetDto = req.body;

      const cancelledBet = await this.matchBetService.cancelFancyBets(matchId, sid, fancyId);

      res.status(200).json({
        status: "success",
        data: cancelledBet
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rollback fancy bets
   * POST /api/v1/match-bets/rollback/fancy/:matchId
   */
  public rollbackFancyBets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = req.params.matchId;
      const { sid, fancyId }: CancelFancyBetDto = req.body;

      const rollbackBet = await this.matchBetService.rollbackFancyBets(matchId, sid, fancyId);

      res.status(200).json({
        status: "success",
        message: "Fancy bets rolled back successfully",
        data: rollbackBet
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel Single bets
   * DELETE /api/v1/match-bets/cancel/single/:betId
   */
  public cancelSingleBet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const betId = req.params.betId;
      const cancelledBet = await this.matchBetService.cancelSingleBet(betId);

      res.status(200).json({
        status: "success",
        message: "Single bet cancelled successfully",
        data: cancelledBet
      });
    } catch (error) {
      next(error);
    }
  }

  public showCancelledSingleBet = async (req: Request, res: Response, next: NextFunction) => {
    try{
      const betId = req.params.betId;
      const cancelledBet = await this.matchBetService.showCancelledSingleBet(betId)

      res.status(200).json({
        status:"success",
        message:"Single cancelled bet fetched successfully",
        data: cancelledBet
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user's exposure and balance (from auth middleware)
   * GET /api/v1/match-bets/my-exposure
   * GET /api/v1/match-bets/my-exposure?matchId=:matchId
   */
  public getMyExposureAndBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Assuming user ID is available from auth middleware
      const userId = (req as any).user?.id || (req as any).user?._id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "User not authenticated"
        });
      }

      const matchId = req.query.matchId as string;

      const exposureData = await this.matchBetService.getUserExposureAndBalance(userId.toString(), matchId);

      res.status(200).json({
        status: "success",
        message: "Your exposure and balance fetched successfully",
        data: {
          wallet: {
            total: exposureData.totalWallet,
            available: exposureData.availableBalance,
            exposure: exposureData.totalExposure
          },
          matchExposure: exposureData.matchExposure,
          exposureBreakdown: exposureData.exposureBreakdown
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

export default MatchBetController;
