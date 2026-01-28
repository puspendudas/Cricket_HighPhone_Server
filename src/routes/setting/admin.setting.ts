import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import adminMiddleware from '@/middlewares/admin.middleware';
import SettingController from '@/controllers/setting';
import { MaintainenceDto, MerchantQrDto, MerchantUPIDto, UpdateSettingDto, UpdateWithdrawlOffDto } from '@/dtos/setting.dto';
import { secureCheckEndpoint } from '@/utils/securityUtils';
// import AdminService from '@/services/admin.service';

class AdminSettingRoute implements Routes {
  public path = '/api/v1/admin/setting';
  public router = Router();
  public settingController = new SettingController();
  // private adminService = new AdminService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.patch(`${this.path}/toggle`, adminMiddleware, this.settingController.toggleAutoActive);
    this.router.patch(`${this.path}/toggle/web`, adminMiddleware, this.settingController.toggleWebActive);
    this.router.patch(`${this.path}/toggle/noti`, adminMiddleware, this.settingController.toggleNotification);
    this.router.patch(`${this.path}/toggle/autodeclare`, adminMiddleware, this.settingController.toggleAutoDeclare);
    this.router.get(`${this.path}/get`, adminMiddleware, this.settingController.getSettings);
    this.router.put(`${this.path}/withdrawl/offday`, validationMiddleware(UpdateWithdrawlOffDto, 'body'), this.settingController.toggleWithdrawlOff);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
    //   async (req, res, next) => {
    //     try {
    //       await this.initializeCronJob();
    //       // After initialization, call the controller method
    //       await this.settingController.getSettings(req, res, next);
    //     } catch (error) {
    //       console.error('Failed to initialize cron job:', error);
    //       next(error);
    //     }
    //   }
    // );
    this.router.put(`${this.path}/update`, adminMiddleware, validationMiddleware(UpdateSettingDto, 'body', true), this.settingController.updateSettings);
    this.router.post(`${this.path}/send`, this.settingController.sendotp);
    this.router.patch(`${this.path}/merchant`, adminMiddleware, validationMiddleware(MerchantUPIDto, 'body', true), this.settingController.merchantChange);
    this.router.patch(`${this.path}/merchantQR`, adminMiddleware, validationMiddleware(MerchantQrDto, 'body', true), this.settingController.merchantQr);
    this.router.put(`${this.path}/maintainence`, adminMiddleware, validationMiddleware(MaintainenceDto, 'body', true), this.settingController.updateMaintenanceMode);
  }

  // private initializeCronJob() {
  //   try {
  //     this.adminService.startCronJob();
  //   } catch (error) {
  //     console.error('Failed to initialize cron job:', error);
  //   }
  // }

}

export default AdminSettingRoute;