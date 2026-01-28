// settlement.route.ts
import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import adminMiddleware from '@/middlewares/admin.middleware';
import authMiddleware from '@/middlewares/auth.middleware';
import { secureCheckEndpoint } from '@/utils/securityUtils';
import SettlementController from '@/controllers/settlement';
import { CreateSettlementDto } from '@/dtos/settlement.dto';

class SettlementRoute implements Routes {
  public path = '/api/v1/admin/settlement';
  public router = Router();
  public settlementController = new SettlementController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/create`, adminMiddleware, validationMiddleware(CreateSettlementDto, 'body', true), this.settlementController.createNewSettlement);
    this.router.get(`${this.path}/get/:id`, adminMiddleware, this.settlementController.getSettlementById);
    this.router.get(`${this.path}/get/user/:id`, authMiddleware, this.settlementController.getSettlementUserById);
    this.router.get(`${this.path}/get/to/:id`, adminMiddleware, this.settlementController.getSettlementToById);
    this.router.get(`${this.path}/get/total/:id`, adminMiddleware, this.settlementController.getSettlementTotalById);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
  }

}

export default SettlementRoute;
