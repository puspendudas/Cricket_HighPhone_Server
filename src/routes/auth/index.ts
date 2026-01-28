import { Router } from 'express';
import AuthController from '@controllers/auth/index';
import { CreateUserDto, ForgotPassUserDto, MobileLoginPassUserDto, MobileLoginPinUserDto, SendOtpUserDto, UserNameLoginPassUserDto, VerifyOtpUserDto } from '@dtos/users.dto';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import checkMaintenanceMode from '@/middlewares/check.middleware';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AuthRoute implements Routes {
  public path = '/api/v1/auth';
  public router = Router();
  public authController = new AuthController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/signup`, checkMaintenanceMode, validationMiddleware(CreateUserDto, 'body'), this.authController.signUp);
    this.router.post(`${this.path}/login`, checkMaintenanceMode, validationMiddleware(UserNameLoginPassUserDto, 'body'), this.authController.logInUserName);
    this.router.get(`${this.path}/me`, checkMaintenanceMode, authMiddleware, this.authController.getMe);
    this.router.post(`${this.path}/refresh`, checkMaintenanceMode, authMiddleware, this.authController.refreshToken);
    this.router.get(`${this.path}/verify`, checkMaintenanceMode, authMiddleware, this.authController.verifyUser);
    this.router.post(`${this.path}/loginpin`, checkMaintenanceMode, validationMiddleware(MobileLoginPinUserDto, 'body'), this.authController.logInPin);
    this.router.post(`${this.path}/loginpass`, checkMaintenanceMode, validationMiddleware(MobileLoginPassUserDto, 'body'), this.authController.logInPass);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
    this.router.post(`${this.path}/send`, checkMaintenanceMode, validationMiddleware(SendOtpUserDto, 'body'), this.authController.sendOtp);
    this.router.post(`${this.path}/verify`, checkMaintenanceMode, validationMiddleware(VerifyOtpUserDto, 'body'), this.authController.verifyOtp);
    this.router.post(`${this.path}/forgotpass`, checkMaintenanceMode, validationMiddleware(ForgotPassUserDto, 'body'), this.authController.forgotPassword);
    this.router.post(`${this.path}/forgotpin`, checkMaintenanceMode, validationMiddleware(ForgotPassUserDto, 'body'), this.authController.forgotPin);
    this.router.post(`${this.path}/logout`, checkMaintenanceMode, authMiddleware, this.authController.logOut);
  }
}

export default AuthRoute;
