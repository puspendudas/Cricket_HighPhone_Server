import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import adminMiddleware from '@/middlewares/admin.middleware';
import NoticeController from '@/controllers/notice';
import { CreateNoticeDto, GetNoticeDto, ToggleNoticeDto } from '@/dtos/notice.dto';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AdminNoticeRoute implements Routes {
  public path = '/api/v1/admin/notice';
  public router = Router();
  public noticeController = new NoticeController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/create`, adminMiddleware, validationMiddleware(CreateNoticeDto, 'body'), this.noticeController.createNotice);
    this.router.get(`${this.path}/get`, adminMiddleware, validationMiddleware(GetNoticeDto, 'query'), this.noticeController.getAllNotices);
    this.router.patch(`${this.path}/toggle`, adminMiddleware, validationMiddleware(ToggleNoticeDto, 'body'), this.noticeController.toggleNotice);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
    this.router.delete(`${this.path}/delete/:notice_id`, adminMiddleware, this.noticeController.deleteNotice);

    
  }

}

export default AdminNoticeRoute;