import { NextFunction, Request, Response } from 'express';
import AutoDeclareService from '@/services/autoDeclare.service';
import { autoDeclareWorkerManager } from '@/utils/autoDeclareWorkerManager';

class AutoDeclareController {
  public autoDeclareService = new AutoDeclareService();

  public getStatus = async (req: Request, res: Response, next: NextFunction) => {
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

  public runAutoDeclareNow = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.autoDeclareService.runAutoDeclareJob();
      res.status(200).json({
        status: 'success',
        message: 'Auto declare run completed',
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  public startAutoDeclareCron = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await autoDeclareWorkerManager.initialize();
      await autoDeclareWorkerManager.startAutoDeclareCronJob();
      res.status(200).json({ status: 'success', message: 'Auto declare cron started' });
    } catch (error) {
      next(error);
    }
  };

  public stopAutoDeclareCron = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await autoDeclareWorkerManager.shutdown();
      res.status(200).json({ status: 'success', message: 'Auto declare cron stopped' });
    } catch (error) {
      next(error);
    }
  };
}

export default AutoDeclareController;
