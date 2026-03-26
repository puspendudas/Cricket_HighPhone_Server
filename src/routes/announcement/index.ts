import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import adminMiddleware from '@/middlewares/admin.middleware';
import AnnouncementController from '@/controllers/announcement';
import { CreateAnnouncementDto, GetAnnouncementDto, ToggleAnnouncementDto } from '@/dtos/announcement.dto';
import { secureCheckEndpoint } from '@/utils/securityUtils';
import authMiddleware from '@/middlewares/auth.middleware';

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

class AdminAnnouncementRoute implements Routes {
  public path = '/api/v1/admin/announcement';
  public router = Router();
  public announcementController = new AnnouncementController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/create`, adminMiddleware, validationMiddleware(CreateAnnouncementDto, 'body'), this.announcementController.createAnnouncement);
    this.router.get(`${this.path}/get`, adminOrUserMiddleware, validationMiddleware(GetAnnouncementDto, 'query'), this.announcementController.getAllAnnouncements);
    this.router.patch(`${this.path}/toggle`, adminMiddleware, validationMiddleware(ToggleAnnouncementDto, 'body'), this.announcementController.toggleAnnouncement);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
    this.router.delete(`${this.path}/delete/:announcement_id`, adminMiddleware, this.announcementController.deleteAnnouncement);


  }

}

export default AdminAnnouncementRoute;
