import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import adminMiddleware from '@/middlewares/admin.middleware';
import NotificationController from '@/controllers/notification';
import { CreateNotificationDto, GetNotificationDto, ToggleNotificationDto } from '@/dtos/notification.dto';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AdminNotificationRoute implements Routes {
  public path = '/api/v1/admin/notification';
  public router = Router();
  public notificationController = new NotificationController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/create`, adminMiddleware, validationMiddleware(CreateNotificationDto, 'body'), this.notificationController.createNewSlider );
    this.router.get(`${this.path}/get`, adminMiddleware, validationMiddleware(GetNotificationDto, 'query'), this.notificationController.getNotification);
    this.router.patch(`${this.path}/toggle`, adminMiddleware, validationMiddleware(ToggleNotificationDto, 'body'), this.notificationController.toggleNotification);
    this.router.delete(`${this.path}/delete/:notification_id`, adminMiddleware, this.notificationController.deleteNotification);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
    this.router.post(`${this.path}/send`, adminMiddleware, validationMiddleware(ToggleNotificationDto, 'body'), this.notificationController.sendNotifications );





  }

}

export default AdminNotificationRoute;