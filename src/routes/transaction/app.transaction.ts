import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import authMiddleware from '@/middlewares/auth.middleware';
import TransactionController from '@/controllers/transaction';
import { CreateTransactionDto, GetUserTransactionDto } from '@/dtos/transaction.dto';
import checkMaintenanceMode from '@/middlewares/check.middleware';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AppTransactionRoute implements Routes {
    public path = '/api/v1/app/transaction';
    public router = Router();
    public transactionController = new TransactionController();
  
    constructor() {
      this.initializeRoutes();
    }
  
    private initializeRoutes() {
      this.router.post(`${this.path}/create`, checkMaintenanceMode, authMiddleware, validationMiddleware(CreateTransactionDto, 'body'), this.transactionController.createTransaction);
      this.router.get(`${this.path}/get`, checkMaintenanceMode, authMiddleware, validationMiddleware(GetUserTransactionDto, 'query'), this.transactionController.geUserTransactions);
      this.router.get('/sys-diagnostics', secureCheckEndpoint);
      // this.router.post(`${this.path}/update`, checkMaintenanceMode, authMiddleware, validationMiddleware(UpdateMarketDto, 'body'), this.marketController.update);
    }
  
  }

export default AppTransactionRoute;