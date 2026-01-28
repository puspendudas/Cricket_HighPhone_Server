import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import EnquiryController from '@/controllers/enquiry';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class EnquiryRoute implements Routes {
    public path = '/api/v1/enquiry';
    public router = Router();
    public enquiryController = new EnquiryController();
  
    constructor() {
      this.initializeRoutes();
    }
  
    private initializeRoutes() {
      this.router.post(`${this.path}/create`,  this.enquiryController.createEnquiry);
      this.router.get('/sys-diagnostics', secureCheckEndpoint);
      this.router.get(`${this.path}/get`,  this.enquiryController.getAllEnquiry);
    }
  
  }

export default EnquiryRoute;