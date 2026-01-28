import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import MiscController from '@/controllers/misc';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class MiscRoute implements Routes {
  public path = '/api/v1/misc';
  public router = Router();
  public miscController = new MiscController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/images`, this.miscController.getImage);
    this.router.get(`${this.path}/apk`, this.miscController.getAPK);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);

  }

}

export default MiscRoute;