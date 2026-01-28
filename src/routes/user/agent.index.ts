import { Router } from 'express';
import UsersController from '@controllers/user/index';
import { ChangePassUserDto, ChangePinUserDto, GetAllUserDto, ToggleUserDto, UpdateUserDto } from '@dtos/users.dto';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import adminMiddleware from '@/middlewares/admin.middleware';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AdminUsersRoute implements Routes {
  public path = '/api/v1/agent/users';
  public router = Router();

  public usersController: UsersController;

  constructor() {
    this.usersController = new UsersController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/all`, adminMiddleware, validationMiddleware(GetAllUserDto, 'query', true), this.usersController.getAllUsers);
    this.router.get(`${this.path}/get/:id`, adminMiddleware, this.usersController.getUserById);
    this.router.put(`${this.path}/update`, adminMiddleware, validationMiddleware(UpdateUserDto, 'body', true), this.usersController.updateUser);
    this.router.delete(`${this.path}/delete/:id`, adminMiddleware, this.usersController.deleteUser);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
    this.router.patch(`${this.path}/changepass`, adminMiddleware, validationMiddleware(ChangePassUserDto, 'body'), this.usersController.changePassword);
    this.router.patch(`${this.path}/changepin`, adminMiddleware, validationMiddleware(ChangePinUserDto, 'body'), this.usersController.changePin);
    this.router.patch(`${this.path}/toggle`, adminMiddleware, validationMiddleware(ToggleUserDto, 'body'), this.usersController.toggleUser);
  }
}

export default AdminUsersRoute;
