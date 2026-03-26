import { NextFunction, Request, Response } from 'express';
import AutoDeclareService from '@/services/autoDeclare.service';
import { autoDeclareWorkerManager } from '@/utils/autoDeclareWorkerManager';

class AutoDeclareController {
  public autoDeclareService = new AutoDeclareService();

  public getStatus = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await autoDeclareWorkerManager.getCronJobsStatus();
      res.status(200).json({
        status: 'success',
        message: 'Auto declare cron status fetched',
        data: status
      });
    } catch (error) {
      next(error);
    }
  };

  /** Run auto-declare for the given match only. matchId from URL params, body, or query. */
  public runAutoDeclareNow = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = req.params?.matchId?.toString?.() ?? '';
      if (!matchId) {
        return res.status(400).json({
          status: 'error',
          message: 'matchId is required in URL. Use POST /api/v1/auto-declare/run/:matchId'
        });
      }
      const result = await this.autoDeclareService.runAutoDeclareForMatch(matchId);
      res.status(200).json({
        status: 'success',
        message: 'Auto declare run completed for match',
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  public startAutoDeclareCron = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await autoDeclareWorkerManager.initialize();
      await autoDeclareWorkerManager.startAutoDeclareCronJob();
      res.status(200).json({ status: 'success', message: 'Auto declare cron started' });
    } catch (error) {
      next(error);
    }
  };

  public stopAutoDeclareCron = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await autoDeclareWorkerManager.shutdown();
      res.status(200).json({ status: 'success', message: 'Auto declare cron stopped' });
    } catch (error) {
      next(error);
    }
  };
}

export default AutoDeclareController;
