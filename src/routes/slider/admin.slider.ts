import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import adminMiddleware from '@/middlewares/admin.middleware';
import SliderController from '@/controllers/slider';
import { SliderDto } from '@/dtos/slider.dto';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AdminSliderRoute implements Routes {
  public path = '/api/v1/admin/slider';
  public router = Router();
  public sliderController = new SliderController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/create`, adminMiddleware, validationMiddleware(SliderDto, 'body', true), this.sliderController.createNewSlider);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
    this.router.get(`${this.path}/get`, adminMiddleware, this.sliderController.getSliders);
    this.router.delete(`${this.path}/delete/:slider_id`, adminMiddleware, this.sliderController.deleteSlider);
    this.router.put(`${this.path}/toggle/:slider_id`, adminMiddleware, this.sliderController.toggleSlider);

  }

}

export default AdminSliderRoute;