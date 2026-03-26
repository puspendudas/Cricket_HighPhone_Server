// match/index.ts

import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@/middlewares/validation.middleware';
import MatchController from '@/controllers/match';
import { CreateMatchDto, UpdateMatchBetDelayDto, UpdateMatchMinMaxDto } from '@/dtos/match.dto';
import adminMiddleware from '@/middlewares/admin.middleware';
import authMiddleware from '@/middlewares/auth.middleware';
import { logger } from '@utils/logger';
import { terminalSocketClient } from '@/services/terminalSocketClient';

// Helper middleware: allows access if either admin or user is authenticated
function adminOrUserMiddleware(req, res, next) {
  // Try adminMiddleware first
  adminMiddleware(req, res, function (adminErr) {
    if (!adminErr) return next(); // admin passed
    // If admin fails, try authMiddleware
    authMiddleware(req, res, function (userErr) {
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
        // these routes are for admin and user both
        // Static `/all/...` paths must stay before `/:matchId` so `all` is never captured as a match id.
        // More specific `/all/declared/...` before `/all/:status` so `declared` is not treated as a status token.
        this.router.get(`${this.path}/all`, adminOrUserMiddleware, this.matchController.getAllMatches);
        this.router.get(`${this.path}/all/declared/:status/:userId`, adminOrUserMiddleware, this.matchController.getAllMatchesByDeclaredStatus);
        this.router.get(`${this.path}/all/:status`, adminOrUserMiddleware, this.matchController.getAllMatchesByStatus);
        this.router.get(`${this.path}/:matchId`, adminOrUserMiddleware, this.matchController.getUndeclaredMatchById);
        this.router.get(`${this.path}/:matchId/all`, adminOrUserMiddleware, this.matchController.getAllMatchById);
        this.router.get(`${this.path}/admin/all/declared/:status/:adminId/:matchId`, adminOrUserMiddleware, this.matchController.getAdminAllMatchesByDeclaredStatus);
        this.router.get(`${this.path}/admin/exposure/:adminId/:matchId`, adminOrUserMiddleware, this.matchController.getAdminExposureMatchesByDeclaredStatus);
        this.router.get(`${this.path}/admin/all/total/:adminId`, adminOrUserMiddleware, this.matchController.getAdminAllMatchesByTotal);
        this.router.post(`${this.path}/create`, adminOrUserMiddleware, validationMiddleware(CreateMatchDto, 'body'), this.matchController.createMatch);
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
            const wsStatus = terminalSocketClient.getStatus();
            res.json({
                success: true,
                message: 'Match data is handled via WebSocket',
                data: {
                    mode: 'websocket',
                    websocket: wsStatus,
                    timestamp: new Date().toISOString(),
                }
            });
        } catch (error) {
            logger.error('Failed to get status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get status',
                error: error.message
            });
        }
    }
}

export default MatchRoute;
