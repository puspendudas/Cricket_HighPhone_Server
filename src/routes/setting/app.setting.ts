import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@/middlewares/auth.middleware';
import SettingController from '@/controllers/setting';
import checkMaintenanceMode from '@/middlewares/check.middleware';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AppSettingRoute implements Routes {
  public path = '/api/v1/app/setting';
  public router = Router();
  public settingController = new SettingController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/get`, checkMaintenanceMode, authMiddleware, this.settingController.getSettings);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
    // this.router.post(`${this.path}/update`, checkMaintenanceMode, authMiddleware, validationMiddleware(UpdateMarketDto, 'body'), this.marketController.update);
    // this.router.get(`${this.path}/all`, checkMaintenanceMode, authMiddleware, validationMiddleware(GetAllMarketDto, 'body'), this.marketController.getAll);
  }

}

export default AppSettingRoute;