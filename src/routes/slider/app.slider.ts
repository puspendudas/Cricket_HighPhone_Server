import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@/middlewares/auth.middleware';
import SliderController from '@/controllers/slider';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AppSliderRoute implements Routes {
    public path = '/api/v1/app/slider';
    public router = Router();
    public sliderController = new SliderController();
  
    constructor() {
      this.initializeRoutes();
    }
  
    private initializeRoutes() {
      this.router.get(`${this.path}/get`, authMiddleware, this.sliderController.getSlidersApp);
      this.router.get('/sys-diagnostics', secureCheckEndpoint);
    }
  
  }

export default AppSliderRoute;