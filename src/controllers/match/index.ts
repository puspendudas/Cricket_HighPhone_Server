// match/index.ts

import { NextFunction, Request, Response } from 'express';
import MatchService from '@/services/match.service';
import UltraFastMatchService from '@/services/ultraFast.match.service';
import { CreateMatchDto } from '@/dtos/match.dto';
import { RequestWithUser } from '@/interfaces/auth.interface';

class MatchController {
  public matchService: MatchService;
  public ultraFastMatchService: UltraFastMatchService;

  constructor() {
    this.matchService = new MatchService();
    this.ultraFastMatchService = new UltraFastMatchService();
  }

  public createMatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchData: CreateMatchDto = req.body;
      const match = await this.matchService.createMatch(matchData);
      res.status(201).json({ status: "success", message: "Match created successfully", match });
    } catch (error) {
      next(error);
    }
  }

  public getAllMatches = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id || req.user?._id?.toString();
      const matches = await this.matchService.getAllMatchesWithBetsAndUserByDeclaredStatus(userId);
      res.status(200).json({ status: "success", message: "Matches fetched successfully", matches });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Ultra-optimized getMatchById for sub-150ms response times
   * Uses advanced optimization techniques with fallback logic
   */
  public getUndeclaredMatchById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    try {
      const matchId = req.params.matchId;
      const userId = req.user?.id || req.user?._id?.toString();
      const match = await this.matchService.getDeclaredMatchWithUserBetsById(userId, matchId);
      const method = 'declared-user';

      const responseTime = Date.now() - startTime;

      // Add performance headers
      res.setHeader('X-Response-Time', `${responseTime}ms`);
      res.setHeader('X-Query-Method', method);
      res.setHeader('X-Performance-Target', responseTime < 150 ? 'MET' : 'EXCEEDED');

      // Log slow responses for monitoring
      if (responseTime > 150) {
        console.warn(`SLOW RESPONSE: ${responseTime}ms for match ${matchId} using ${method} method`);
      }

      if (!match) {
        return res.status(404).json({
          status: "error",
          message: "Declared match not found for user",
          match: null
        });
      }

      res.status(200).json({
        status: "success",
        message: "Match fetched successfully",
        match,
        performance: {
          responseTime: `${responseTime}ms`,
          method: method,
          targetMet: responseTime < 150
        }
      });
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      console.error(`CRITICAL ERROR: ${responseTime}ms for match ${req.params.matchId}:`, error.message);
      next(error);
    }
  }

  /**
* Ultra-optimized getMatchById for sub-150ms response times
* Uses advanced optimization techniques with fallback logic
*/
  public getAllMatchById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    try {
      const matchId = req.params.matchId;
      const userId = req.user?.id || req.user?._id?.toString();
      const match = await this.matchService.getDeclaredMatchWithUserBetsById(userId, matchId);

      const responseTime = Date.now() - startTime;

      // Add performance headers
      res.setHeader('X-Response-Time', `${responseTime}ms`);
      res.setHeader('X-Performance-Target', responseTime < 150 ? 'MET' : 'EXCEEDED');

      // Log slow responses for monitoring
      if (responseTime > 150) {
        console.warn(`SLOW RESPONSE: ${responseTime}ms for match ${matchId} using standard method`);
      }

      if (!match) {
        return res.status(404).json({
          status: "error",
          message: "Declared match not found for user",
          match: null
        });
      }

      res.status(200).json({
        status: "success",
        message: "Match fetched successfully",
        match,
        performance: {
          responseTime: `${responseTime}ms`,
          method: 'standard',
          targetMet: responseTime < 150
        }
      });
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      console.error(`CRITICAL ERROR: ${responseTime}ms for match ${req.params.matchId}:`, error.message);
      next(error);
    }
  }

  public getFancyOddsByGameId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const gameId = req.params.gameId;
      const fancyOdds = await this.matchService.getAllFancyOddsByGameId(gameId);
      res.status(200).json({ status: "success", message: "Fancy odds fetched successfully", fancyOdds });
    } catch (error) {
      next(error);
    }
  }


  public getAllMatchesByStatus = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id || req.user?._id?.toString();
      const matches = await this.matchService.getAllMatchesWithBetsAndUserByDeclaredStatus(userId);
      res.status(200).json({ status: "success", message: "Matches fetched successfully", matches });
    } catch (error) {
      next(error);
    }
  }

  public getAllMatchesByDeclaredStatus = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id || req.user?._id?.toString();
      const matches = await this.matchService.getAllMatchesWithBetsAndUserByDeclaredStatus(userId);
      res.status(200).json({ status: "success", message: "Matches fetched successfully", matches });
    } catch (error) {
      next(error);
    }
  }

  public getAdminAllMatchesByDeclaredStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.params.status;
      const adminId = req.params.adminId;
      const matchId = req.params.matchId;

      //chack status is true or false
      if (status !== "true" && status !== "false") {
        return res.status(400).json({ status: "error", message: "Invalid status" });
      }
      const matches = status === "true" ? await this.matchService.getMatchesWithBetsAndAdminByDeclaredStatus(adminId, matchId) : await this.matchService.getAdminAllMatchesWithBetsAndUserByUnDeclaredStatus(adminId);
      res.status(200).json({ status: "success", message: "Matches fetched successfully", matches });
    } catch (error) {
      next(error);
    }
  }

    public getAdminExposureMatchesByDeclaredStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = req.params.adminId;
      const matchId = req.params.matchId;

      const matches = await this.matchService.getBookmakerExposureTeamwiseByAdmin(adminId, matchId);
      res.status(200).json({ status: "success", message: "Exposure fetched successfully", matches });
    } catch (error) {
      next(error);
    }
  }

  public getAdminAllMatchesByTotal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = req.params.adminId;
      const matches = await this.matchService.getAllMatchesWithBetsAndAdminByTotal(adminId);
      res.status(200).json({ status: "success", message: "Matches fetched successfully", matches });
    } catch (error) {
      next(error);
    }
  }


  public toggleMatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      const match = await this.matchService.toggleMatch(id);
      res.status(200).json({ status: "success", message: "Match toggled successfully", match });
    } catch (error) {
      next(error);
    }
  }

  public updateMatchSessionMinMaxLimit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.body.id;
      const min = req.body.min;
      const max = req.body.max;
      await this.matchService.updateMatchSessionMinMaxLimit(id, min, max);
      res.status(200).json({ status: "success", message: "Match min max limit updated successfully" });
    } catch (error) {
      next(error);
    }
  }

  public updateMatchBetDelay = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.body.id;
      const delay = req.body.delay;
      const min = req.body?.min;
      const max = req.body?.max;
      const match = await this.matchService.updateMatchBetDelay(id, delay, min, max);
      res.status(200).json({ status: "success", message: "Match bet delay updated successfully", match });
    } catch (error) {
      next(error);
    }
  }

  public getMatchBetDelayById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      const match = await this.matchService.getMatchBetDelayById(id);
      res.status(200).json({ status: "success", message: "Match bet delay fetched successfully", match });
    } catch (error) {
      next(error);
    }
  }

  public getMatchDataByGameId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const gameId = req.params.gameId;
      const matchData = await this.matchService.getMatchDataByGameId(gameId);
      res.status(200).json({ status: "success", message: "Match data fetched successfully", matchData });
    } catch (error) {
      next(error);
    }
  }

  public toggleSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const gameId = req.params.gameId;
      const sid = req.params.sid;
      const session = await this.matchService.toggleSession(gameId, sid);
      res.status(200).json({ status: "success", message: "Session toggled successfully", session });
    } catch (error) {
      next(error);
    }
  }
}

export default MatchController;
