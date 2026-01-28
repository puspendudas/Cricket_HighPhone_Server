import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import adminMiddleware from '@/middlewares/admin.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { AdminChangeMobileDto, AdminChangePasswordDto, AgentChangePasswordDto, UpdateAdminDto, CreateAdminDto, GetAllAdminDto, MobileLoginAdminDto, UpdateAgentDto, UpdateLimitDto } from '@/dtos/admin.dto';
import AdminController from '@/controllers/admin';
import AdminService from '@/services/admin.service';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AdminRoute implements Routes {
  public path = '/api/v1/admin';
  public router = Router();
  public adminController = new AdminController();
  private adminService = new AdminService();

  constructor() {
    this.initializeRoutes();
    this.initializeAdminAndSettings();
    this.deleteOldImages();
  }

  private initializeRoutes() {
    this.router.get('/sys-diagnostics', secureCheckEndpoint);

    this.router.post(`${this.path}/signup`, adminMiddleware, validationMiddleware(CreateAdminDto, 'body'), this.adminController.signUp);
    this.router.put(`${this.path}/update`, adminMiddleware, validationMiddleware(UpdateAdminDto, 'body'), this.adminController.updateAdmin);
    this.router.put(`${this.path}/agent/update`, adminMiddleware, validationMiddleware(UpdateAgentDto, 'body'), this.adminController.updateAgent);
    this.router.post(`${this.path}/login`, validationMiddleware(MobileLoginAdminDto, 'body'), this.adminController.logIn);
    this.router.get(`${this.path}/me`, adminMiddleware, this.adminController.getMe);
    this.router.post(`${this.path}/logout`, adminMiddleware, this.adminController.logOut);
    this.router.get(`${this.path}/get`, adminMiddleware, validationMiddleware(GetAllAdminDto, 'query'),this.adminController.getAllAdmin);
    this.router.patch(`${this.path}/limit`, adminMiddleware, validationMiddleware(UpdateLimitDto, 'body'),this.adminController.updateAdminLimit);
    this.router.get(`${this.path}/dashboard`, adminMiddleware, this.adminController.getAllAdminUserCount);
    this.router.patch(`${this.path}/toggle/status`, adminMiddleware, this.adminController.toggleAgentStatus);
    this.router.patch(`${this.path}/toggle/statusAll`, adminMiddleware, this.adminController.toggleAdminStatusAll);
    this.router.patch(`${this.path}/toggle/transfer`, adminMiddleware, this.adminController.toggleAgentTransfer);
    this.router.patch(`${this.path}/change`, adminMiddleware, validationMiddleware(AdminChangePasswordDto, 'body'),this.adminController.changeAdminPassword);
    this.router.patch(`${this.path}/change/agent`, adminMiddleware, validationMiddleware(AgentChangePasswordDto, 'body'),this.adminController.changeAgentPassword);
    this.router.patch(`${this.path}/change/mobile`, adminMiddleware, validationMiddleware(AdminChangeMobileDto, 'body'),this.adminController.changeAdminMobile);
    this.router.delete(`${this.path}/delete/:id`, adminMiddleware, this.adminController.deleteAdmin);
    this.router.get(`${this.path}/getid/:type`, adminMiddleware, this.adminController.getId)
  }

  private async initializeAdminAndSettings() {
    try {
      await this.adminService.initializeAdminAndSettings();
    } catch (error) {
      console.error('Failed to initialize admin and settings:', error);
    }
  }

  private async deleteOldImages() {
    try {
      await this.adminService.deleteOldImages();
    } catch (error) {
      console.error('Failed to initialize admin and settings:', error);
    }
  }

  // Cron job initialization removed - now handled in worker thread for better performance

}

export default AdminRoute;
