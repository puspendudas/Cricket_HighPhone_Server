import { NextFunction, Request, Response } from 'express';
import NotificationService from '@/services/notification.service';
import { CreateNotificationDto, GetNotificationDto, ToggleNotificationDto } from '@/dtos/notification.dto';

class NotificationController {
  public notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  public createNewSlider = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notificationData: CreateNotificationDto = req.body;
      await this.notificationService.createNotifications(notificationData);
      res.status(201).json({ status: 'success', message: 'operation successful' });
    } catch (err) {
      // if (err.message === 'need a tag') {
      //   return res.status(400).json({ status: 'failure', message: err.message });
      // } else if (err.message === 'only 1 file upload is permitted') {
      return res.status(400).json({ status: 'failure', message: err.message });
      // }
      next(err);
    }
  } 

  public getNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const getNoticeData: GetNotificationDto = req.query;
      const result = await this.notificationService.getAllNotification(getNoticeData);
      res.status(200).json({ status: "success", ...result });
    } catch (err) {
      next(err);
    }
  }

  public toggleNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const noticeToggleData: ToggleNotificationDto = req.body;
      await this.notificationService.toggleNotification(noticeToggleData);
      res.status(200).json({ status: 'success', message: "toggle operation success" });

    } catch (err) {
      next(err);
    }
  };

  public deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { notification_id: NoticeData } = req.params;
      const result = await this.notificationService.deleteNotification(NoticeData);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public sendNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notificationData: ToggleNotificationDto = req.body;
      await this.notificationService.sendNotifications(notificationData);
      res.status(201).json({ status: 'success', message: 'operation successful' });
    } catch (err) {
      if (err.message === 'need a tag') {
        return res.status(400).json({ status: 'failure', message: err.message });
      } else if (err.message === 'only 1 file upload is permitted') {
        return res.status(400).json({ status: 'failure', message: err.message });
      }
      next(err);
    }
  }

}

export default NotificationController;