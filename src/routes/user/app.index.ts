import { Router } from 'express';
import UsersController from '@controllers/user/index';
import { ChangePassUserDto, ChangePinUserDto, ToggleUserNotiDto, UpdateUserDto } from '@dtos/users.dto';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import authMiddleware from '@/middlewares/auth.middleware';
import checkMaintenanceMode from '@/middlewares/check.middleware';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AppUsersRoute implements Routes {
  public path = '/api/v1/app/users';
  public router = Router();

  public usersController: UsersController;

  constructor() {
    this.usersController = new UsersController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/get/:id`, checkMaintenanceMode, authMiddleware, this.usersController.getUserById);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
    this.router.put(`${this.path}/update`, checkMaintenanceMode, authMiddleware, validationMiddleware(UpdateUserDto, 'body', true), this.usersController.updateUser);
    this.router.post(`${this.path}/changepass`, checkMaintenanceMode, authMiddleware, validationMiddleware(ChangePassUserDto, 'body'), this.usersController.changePassword);
    this.router.post(`${this.path}/changepin`, checkMaintenanceMode, authMiddleware, validationMiddleware(ChangePinUserDto, 'body'), this.usersController.changePin);
    this.router.delete(`${this.path}/delete/:id`, checkMaintenanceMode, authMiddleware, this.usersController.deleteUser);
    this.router.patch(`${this.path}/toggle/noti`, checkMaintenanceMode, authMiddleware, validationMiddleware(ToggleUserNotiDto, 'body'), this.usersController.toggleUserNotification);
    this.router.get(`${this.path}/quiz/:length`, checkMaintenanceMode, authMiddleware, this.usersController.getRandomQuiz);

  }
}

export default AppUsersRoute;
