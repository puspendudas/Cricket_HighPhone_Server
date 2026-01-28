import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import { GetAllBetDto } from '@/dtos/bet.dto';
import BetController from '@/controllers/bet';
import { secureCheckEndpoint } from '@/utils/securityUtils';
import agentMiddleware from '@/middlewares/agent.middleware';

class AgentBetRoute implements Routes {
  public path = '/api/v1/agent/bet';
  public router = Router();
  public betController = new BetController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/all`, agentMiddleware, validationMiddleware(GetAllBetDto, 'query', true), this.betController.getBet);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
  }

}


export default AgentBetRoute;