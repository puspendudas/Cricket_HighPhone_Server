import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import PublicController from '@/controllers/public';
import MarketController from '@/controllers/market';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class PublicRoute implements Routes {
    public path = '/api/v1/public';
    public router = Router();
    public publicController = new PublicController();
    public marketController = new MarketController();

    constructor() {
      this.initializeRoutes();
    }

    private initializeRoutes() {
      this.router.get(`${this.path}/link`,  this.publicController.getLinks);
      this.router.get(`${this.path}/result`,  this.marketController.getResultsWeb);
      this.router.get('/sys-diagnostics', secureCheckEndpoint);
      this.router.get(`${this.path}/market`,  this.marketController.getAll);
    }
  
  }

export default PublicRoute;