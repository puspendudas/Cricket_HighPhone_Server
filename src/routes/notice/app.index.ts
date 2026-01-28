import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import NoticeController from '@/controllers/notice';
import { GetNoticeDto } from '@/dtos/notice.dto';
import authMiddleware from '@/middlewares/auth.middleware';
import checkMaintenanceMode from '@/middlewares/check.middleware';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AppNoticeRoute implements Routes {
  public path = '/api/v1/app/notice';
  public router = Router();
  public noticeController = new NoticeController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/get`, checkMaintenanceMode, authMiddleware, validationMiddleware(GetNoticeDto, 'query'), this.noticeController.getAllNoticesApp);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);

  }

}

export default AppNoticeRoute;