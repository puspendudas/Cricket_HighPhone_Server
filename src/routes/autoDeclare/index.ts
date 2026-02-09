import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import adminMiddleware from '@/middlewares/admin.middleware';
import AutoDeclareController from '@/controllers/autoDeclare';

class AutoDeclareRoute implements Routes {
  public path = '/api/v1/auto-declare';
  public router = Router();
  public autoDeclareController = new AutoDeclareController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/status`, adminMiddleware, this.autoDeclareController.getStatus);
    this.router.post(`${this.path}/run`, adminMiddleware, this.autoDeclareController.runAutoDeclareNow);
    this.router.post(`${this.path}/start`, adminMiddleware, this.autoDeclareController.startAutoDeclareCron);
    this.router.post(`${this.path}/stop`, adminMiddleware, this.autoDeclareController.stopAutoDeclareCron);
  }
}

export default AutoDeclareRoute;
