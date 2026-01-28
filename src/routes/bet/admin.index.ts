import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import { GetAllBetDto, PointsBetDto, PonitsBetAllDto, ProfitBetDto, UpdateBetDto } from '@/dtos/bet.dto';
import BetController from '@/controllers/bet';
import adminMiddleware from '@/middlewares/admin.middleware';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AdminBetRoute implements Routes {
  public path = '/api/v1/admin/bet';
  public router = Router();
  public betController = new BetController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/update`, adminMiddleware, validationMiddleware(UpdateBetDto, 'body'), this.betController.updateBetArray);
    this.router.post(`${this.path}/points`, adminMiddleware, validationMiddleware(PointsBetDto, 'body'), this.betController.getPointsAmount);
    this.router.post(`${this.path}/points/all`,  validationMiddleware(PonitsBetAllDto, 'body'), this.betController.getAllPointsAmount);
    this.router.get(`${this.path}/all`, adminMiddleware, validationMiddleware(GetAllBetDto, 'query', true), this.betController.getBet);
    this.router.get(`${this.path}/profit`, adminMiddleware, validationMiddleware(ProfitBetDto, 'query', true), this.betController.getProfitLossAmount);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
  }

}


export default AdminBetRoute;