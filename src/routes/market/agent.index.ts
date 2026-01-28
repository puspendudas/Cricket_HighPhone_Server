import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import { TodayDataDto, TotalDataDto } from '@/dtos/market.dto';
import MarketController from '@/controllers/market';
import { secureCheckEndpoint } from '@/utils/securityUtils';
import agentMiddleware from '@/middlewares/agent.middleware';

class AgentMarketRoute implements Routes {
  public path = '/api/v1/agent/market';
  public router = Router();
  public marketController = new MarketController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get('/sys-diagnostics', secureCheckEndpoint);

    //dashboard total menu
    this.router.get(`${this.path}/today`, agentMiddleware, validationMiddleware(TodayDataDto, 'query'), this.marketController.getTodayData);
    this.router.get(`${this.path}/total`, agentMiddleware, validationMiddleware(TotalDataDto, 'query'), this.marketController.getTotalData);
  }

}

export default AgentMarketRoute;