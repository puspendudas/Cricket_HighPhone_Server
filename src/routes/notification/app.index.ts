import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import NotificationController from '@/controllers/notification';
import { GetNotificationDto } from '@/dtos/notification.dto';
import authMiddleware from '@/middlewares/auth.middleware';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AppNotificationRoute implements Routes {
  public path = '/api/v1/app/notification';
  public router = Router();
  public notificationController = new NotificationController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/get`, authMiddleware, validationMiddleware(GetNotificationDto, 'query'), this.notificationController.getNotification);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
  }

}

export default AppNotificationRoute;