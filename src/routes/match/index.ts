// match/index.ts

import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@/middlewares/validation.middleware';
import MatchController from '@/controllers/match';
import { CreateMatchDto, UpdateMatchBetDelayDto, UpdateMatchMinMaxDto } from '@/dtos/match.dto';
import adminMiddleware from '@/middlewares/admin.middleware';
import authMiddleware from '@/middlewares/auth.middleware';
import { logger } from '@utils/logger';

// Helper middleware: allows access if either admin or user is authenticated
function adminOrUserMiddleware(req, res, next) {
  // Try adminMiddleware first
  adminMiddleware(req, res, function(adminErr) {
    if (!adminErr) return next(); // admin passed
    // If admin fails, try authMiddleware
    authMiddleware(req, res, function(userErr) {
      if (!userErr) return next(); // user passed
      // If both fail, return the admin error (or user error if admin error is not present)
      return next(adminErr || userErr);
    });
  });
}

class MatchRoute implements Routes {
    public path = '/api/v1/match';
    public router = Router();
    public matchController = new MatchController();

    constructor() {
        this.initializeRoutes();
    }

    // ROUTES FOR MATCHES
    private initializeRoutes() {
        // user routes (declared matches only, with user bets)
        this.router.get(`${this.path}/all`, authMiddleware, this.matchController.getAllMatches);
        this.router.get(`${this.path}/:matchId`, authMiddleware, this.matchController.getUndeclaredMatchById);
        this.router.get(`${this.path}/:matchId/all`, authMiddleware, this.matchController.getAllMatchById);
        this.router.get(`${this.path}/all/:status`, adminOrUserMiddleware, this.matchController.getAllMatchesByStatus);
        this.router.get(`${this.path}/all/declared/:status/:userId`, authMiddleware, this.matchController.getAllMatchesByDeclaredStatus);

        // admin routes (full access)
        this.router.get(`${this.path}/admin/all/declared/:status/:adminId/:matchId`, adminMiddleware, this.matchController.getAdminAllMatchesByDeclaredStatus);
        this.router.get(`${this.path}/admin/exposure/:adminId/:matchId`, adminMiddleware, this.matchController.getAdminExposureMatchesByDeclaredStatus);
        this.router.get(`${this.path}/admin/all/total/:adminId`, adminMiddleware, this.matchController.getAdminAllMatchesByTotal);
        this.router.post(`${this.path}/create`, adminMiddleware, validationMiddleware(CreateMatchDto, 'body'), this.matchController.createMatch);
        this.router.patch(`${this.path}/toggle/:id`, adminMiddleware, this.matchController.toggleMatch);
        this.router.patch(`${this.path}/session/limit`, adminMiddleware, validationMiddleware(UpdateMatchMinMaxDto, 'body'), this.matchController.updateMatchSessionMinMaxLimit);
        this.router.get(`${this.path}/delay/:id`, adminMiddleware, this.matchController.getMatchBetDelayById);
        this.router.patch(`${this.path}/delay`, adminMiddleware, validationMiddleware(UpdateMatchBetDelayDto, 'body'), this.matchController.updateMatchBetDelay);
        this.router.get(`${this.path}/cron-status`, adminOrUserMiddleware, this.getCronJobStatus);
        this.router.get(`${this.path}/odds/:gameId`, adminOrUserMiddleware, this.matchController.getMatchDataByGameId);
        this.router.get(`${this.path}/odds/fancy/:gameId`, adminOrUserMiddleware, this.matchController.getFancyOddsByGameId);
        this.router.patch(`${this.path}/togglesession/:gameId/:sid`, adminOrUserMiddleware, this.matchController.toggleSession);
    }

    /**
     * Get cron job status from worker thread
     * Note: This endpoint now returns a message indicating cron jobs are handled in worker thread
     */
    private getCronJobStatus = (req: any, res: any) => {
        try {
            res.json({
                success: true,
                message: 'Match cron jobs are now handled in worker thread for better performance',
                data: {
                    workerThread: true,
                    timestamp: new Date().toISOString(),
                    note: 'Use /api/v1/cron-status endpoint to get detailed worker thread status'
                }
            });
        } catch (error) {
            logger.error('Failed to get cron job status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get cron job status',
                error: error.message
            });
        }
    }
}

export default MatchRoute;
