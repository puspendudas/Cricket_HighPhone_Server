import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import { CreateBetDto, GetUserBetDto } from '@/dtos/bet.dto';
import BetController from '@/controllers/bet';
import authMiddleware from '@/middlewares/auth.middleware';
import checkMaintenanceMode from '@/middlewares/check.middleware';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AppBetRoute implements Routes {
  public path = '/api/v1/app/bet';
  public router = Router();
  public betController = new BetController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/create`, checkMaintenanceMode, authMiddleware, validationMiddleware(CreateBetDto, 'body'), this.betController.create);
    this.router.get(`${this.path}/get`, checkMaintenanceMode, authMiddleware, validationMiddleware(GetUserBetDto, 'query', true), this.betController.getUserBet);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
    // this.router.post(`${this.path}/login`, checkMaintenanceMode, validationMiddleware(MobileLoginAdminDto, 'body'), this.adminController.logIn);
    // this.router.post(`${this.path}/logout`, checkMaintenanceMode, adminMiddleware, this.adminController.logOut);
  }

}


export default AppBetRoute;