import { Router } from 'express';
import UsersController from '@controllers/user/index';
import { ChangePassUserDto, ChangePinUserDto, GetAllUserDto, ToggleUserDto, UpdateUserDto, CreateClientDto, UpdateUserRateDiffDto, ChangePasswordUserDto, UpdateUserStackDto, UpdateUserMatchLockDto, UpdateUserAllMatchLockDto } from '@dtos/users.dto';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import adminMiddleware from '@/middlewares/admin.middleware';
import { secureCheckEndpoint } from '@/utils/securityUtils';
import authMiddleware from '@/middlewares/auth.middleware';
import { UpdateLimitDto } from '@/dtos/admin.dto';
import { GetWalletHistoryDto } from '@/dtos/walletHistory.dto';
import WalletHistoryController from '@/controllers/walletHistory';

// Helper middleware: allows access if either admin or user is authenticated
function adminOrUserMiddleware(req, res, next) {
  // Try adminMiddleware first
  adminMiddleware(req, res, function(adminErr) {
    if (!adminErr) return next(); // admin passed
    // If admin fails, try authMiddleware
    authMiddleware(req, res, function(userErr) {
      if (!userErr) return next(); // user passed
      // If both fail, return the admin error (or user error if admin error is not present)
      return next(adminErr || userErr);
    });
  });
}
class AdminUsersRoute implements Routes {
  public path = '/api/v1/admin/users';
  public router = Router();

  public usersController: UsersController;
  public walletHistoryController: WalletHistoryController;

  constructor() {
    this.usersController = new UsersController();
    this.walletHistoryController = new WalletHistoryController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/all`, adminMiddleware, validationMiddleware(GetAllUserDto, 'query', true), this.usersController.getAllUsers);
    this.router.get(`${this.path}/get/:id`, adminMiddleware, this.usersController.getUserById);
    this.router.put(`${this.path}/update`, adminMiddleware, validationMiddleware(UpdateUserDto, 'body', true), this.usersController.updateUser);
    this.router.post(`${this.path}/create`, adminMiddleware, validationMiddleware(CreateClientDto, 'body', true), this.usersController.createUser);
    this.router.post(`${this.path}/change/:userId`, adminOrUserMiddleware, validationMiddleware(ChangePasswordUserDto, 'body', true), this.usersController.changeUserPassword);
    this.router.post(`${this.path}/rate`, adminOrUserMiddleware, validationMiddleware(UpdateUserRateDiffDto, 'body', true), this.usersController.updateUserRateDiff);
    this.router.get(`${this.path}/stack/:userId`, adminOrUserMiddleware, this.usersController.getUserStack);
    this.router.post(`${this.path}/bmlock`, adminMiddleware, validationMiddleware(UpdateUserMatchLockDto, 'body', true), this.usersController.updateUserMatchBmLock);
    this.router.post(`${this.path}/bmlockall`, adminMiddleware, validationMiddleware(UpdateUserAllMatchLockDto, 'body', true), this.usersController.updateUserAllMatchBmLock);
    this.router.post(`${this.path}/fancylock`, adminMiddleware, validationMiddleware(UpdateUserMatchLockDto, 'body', true), this.usersController.updateUserMatchFancyLock);
    this.router.post(`${this.path}/fancylockall`, adminMiddleware, validationMiddleware(UpdateUserAllMatchLockDto, 'body', true), this.usersController.updateUserAllMatchFancyLock);
    this.router.patch(`${this.path}/limit`, adminMiddleware, validationMiddleware(UpdateLimitDto, 'body'),this.usersController.updateUserLimit);
    this.router.get(`${this.path}/wallethistory`, adminOrUserMiddleware, validationMiddleware(GetWalletHistoryDto, 'query', true), this.walletHistoryController.getAllWalletHistorys);
    this.router.post(`${this.path}/stack`, adminOrUserMiddleware, validationMiddleware(UpdateUserStackDto, 'body', true), this.usersController.updateUserStack);
    this.router.delete(`${this.path}/stack`, adminOrUserMiddleware, validationMiddleware(UpdateUserStackDto, 'body', true), this.usersController.deleteUserStack);
    this.router.delete(`${this.path}/stack`, adminOrUserMiddleware, validationMiddleware(UpdateUserStackDto, 'body', true), this.usersController.deleteUserStack);
    this.router.delete(`${this.path}/delete/:id`, adminMiddleware, this.usersController.deleteUser);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
    this.router.get(`${this.path}/getid`, adminMiddleware, this.usersController.getClientId)
    this.router.patch(`${this.path}/changepass`, adminMiddleware, validationMiddleware(ChangePassUserDto, 'body'), this.usersController.changePassword);
    this.router.patch(`${this.path}/changepin`, adminMiddleware, validationMiddleware(ChangePinUserDto, 'body'), this.usersController.changePin);
    this.router.patch(`${this.path}/toggle`, adminMiddleware, validationMiddleware(ToggleUserDto, 'body'), this.usersController.toggleUser);
  }
}

export default AdminUsersRoute;
