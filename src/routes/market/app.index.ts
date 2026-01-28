import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import { GetAllMarketDto, GetResultsDto, ToggleMarketDto } from '@/dtos/market.dto';
import MarketController from '@/controllers/market';
import authMiddleware from '@/middlewares/auth.middleware';
import checkMaintenanceMode from '@/middlewares/check.middleware';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AppMarketRoute implements Routes {
  public path = '/api/v1/app/market';
  public router = Router();
  public marketController = new MarketController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
    this.router.get(`${this.path}/all`, checkMaintenanceMode, authMiddleware, validationMiddleware(GetAllMarketDto, 'query'), this.marketController.getAllApp);
    this.router.get(`${this.path}/games`, checkMaintenanceMode, validationMiddleware(ToggleMarketDto, 'query'), this.marketController.marketGames);
    this.router.get(`${this.path}/result/get`, checkMaintenanceMode, authMiddleware, validationMiddleware(GetResultsDto, 'query'), this.marketController.getResultsApp);
  }

}

export default AppMarketRoute;