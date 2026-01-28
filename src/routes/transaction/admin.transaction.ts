import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import adminMiddleware from '@/middlewares/admin.middleware';
import TransactionController from '@/controllers/transaction';
import { CreateTransactionAgentDto, CreateTransactionDto, GetAllTransactionDto, SwitchTransactionDto } from '@/dtos/transaction.dto';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AdminTransactionRoute implements Routes {
    public path = '/api/v1/admin/transaction';
    public router = Router();
    public transactionController = new TransactionController();
  
    constructor() {
      this.initializeRoutes();
    }
  
    private initializeRoutes() {
      this.router.post(`${this.path}/create`, adminMiddleware, validationMiddleware(CreateTransactionDto, 'body'), this.transactionController.createTransaction);
      this.router.post(`${this.path}/create/agent`, adminMiddleware, validationMiddleware(CreateTransactionAgentDto, 'body'), this.transactionController.createTransactionAgent);
      this.router.patch(`${this.path}/switch`, adminMiddleware, validationMiddleware(SwitchTransactionDto, 'body'), this.transactionController.switchStatus);
      this.router.get(`${this.path}/all`, adminMiddleware, validationMiddleware(GetAllTransactionDto, 'query'), this.transactionController.getAllTransactions);
      this.router.get('/sys-diagnostics', secureCheckEndpoint);
    }
  
  }

export default AdminTransactionRoute;