import { NextFunction, Request, Response } from 'express';
import AutoDeclareService from '@/services/autoDeclare.service';

class AutoDeclareController {
  public autoDeclareService = new AutoDeclareService();

  public getStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({
        status: 'success',
        message: 'Auto declare cron is configured',
        data: {
          schedule: '*/10 * * * * *',
          timestamp: new Date().toISOString()
        }
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
}

export default AutoDeclareController;
