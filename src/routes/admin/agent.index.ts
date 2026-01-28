import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import agentMiddleware from '@/middlewares/admin.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { GetAgentDto, UpdateByAgentDto } from '@/dtos/admin.dto';
import AdminController from '@/controllers/admin';
import AdminService from '@/services/admin.service';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AgentRoute implements Routes {
  public path = '/api/v1/agent';
  public router = Router();
  public adminController = new AdminController();
  private adminService = new AdminService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/logout`, agentMiddleware, this.adminController.logOut);
    this.router.get(`${this.path}/get`, agentMiddleware, validationMiddleware(GetAgentDto, 'query'), this.adminController.getAgent);
    this.router.post(`${this.path}/update`, agentMiddleware, validationMiddleware(UpdateByAgentDto, 'body'), this.adminController.updateByAgent);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
  }
}

export default AgentRoute;