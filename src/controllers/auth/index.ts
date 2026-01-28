import { NextFunction, Request, Response } from 'express';
import { CreateUserDto, ForgotPassUserDto, ForgotPinUserDto, MobileLoginPassUserDto, MobileLoginPinUserDto, SendOtpUserDto, UserNameLoginPassUserDto, VerifyOtpUserDto } from '@dtos/users.dto';
import { User } from '@interfaces/users.interface';
import { RequestWithUser } from '@interfaces/auth.interface';
import AuthService from '@services/auth.service';

class AuthController {
  public authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  public signUp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: CreateUserDto = req.body;
      const signUpUserData = await this.authService.signup(userData);

      res.status(201).json({ message: 'signup' , data: { id: signUpUserData.id, mobile: signUpUserData.mobile } });
    } catch (error) {
      next(error);
    }
  };

  public logInPin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: MobileLoginPinUserDto = req.body;
      const { cookie, tokenData, findUser } = await this.authService.loginPin(userData);

      res.setHeader('Set-Cookie', [cookie]);
      res.status(200).json({
        status: 'success',
        message: 'Login SuccessFull',
        tokenData,
        cookie,
        data: { id: findUser.id, mobile: findUser.mobile, verified: findUser.verified },
      });
    } catch (error) {
      next(error);
    }
  };

  public logInPass = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: MobileLoginPassUserDto = req.body;
      const { cookie, tokenData, findUser } = await this.authService.loginPass(userData);

      res.setHeader('Set-Cookie', [cookie]);
      res.status(200).json({
        status: 'success',
        message: 'Login SuccessFull',
        tokenData,
        cookie,
        data: { id: findUser.id, mobile: findUser.mobile, verified: findUser.verified },
      });
    } catch (error) {
      next(error);
    }
  };

  public logInUserName = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: UserNameLoginPassUserDto = req.body;
      const { cookie, tokenData, findUser } = await this.authService.loginUserName(userData);

      res.setHeader('Set-Cookie', [cookie]);
      res.status(200).json({
        status: 'success',
        message: 'Login SuccessFull',
        tokenData,
        cookie,
        data: { id: findUser.id, mobile: findUser.mobile, verified: findUser.verified },
      });
    } catch (error) {
      next(error);
    }
  };

  public getMe = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userData: User = req.user;
      res.status(200).json({ message: 'Check SuccessFull', data: userData });
    } catch (error) {
      next(error);
    }
  };

  public refreshToken = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userData: User = req.user;
      const { cookie, tokenData } = await this.authService.refreshToken(userData);

      res.setHeader('Set-Cookie', [cookie]);
      res.status(200).json({
        status: 'success',
        message: 'Refresh Token SuccessFull',
        tokenData,
        cookie
      });
    } catch (error) {
      next(error);
    }
  };

  public verifyUser = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userData: User = req.user;
      res.status(200).json({ message: 'Check SuccessFull', data: userData });
    } catch (error) {
      next(error);
    }
  };

  public sendOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: SendOtpUserDto = req.body;
      await this.authService.sendotp(userData);

      res.status(201).json({ status:'success', message: 'Send OTP successfully' });
    } catch (error) {
      next(error);
    }
  };

  public verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: VerifyOtpUserDto = req.body;
      const { cookie, tokenData, findUser } = await this.authService.verifyotp(userData);

      res.setHeader('Set-Cookie', [cookie]);
      res.status(200).json({
        status: 'success',
        message: 'verify OTP SuccessFull',
        tokenData,
        cookie,
        data: { id: findUser.id, mobile: findUser.mobile },
      });
    } catch (error) {
      next(error);
    }
  };

  public forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ForgotPasswordData: ForgotPassUserDto = req.body;
      await this.authService.forgotPassword(ForgotPasswordData);
      res.status(200).json({ status: 'success', message: "Operation successful" });

    } catch (err) {
      next(err);
    }
  };

  public forgotPin= async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ForgotPasswordData: ForgotPinUserDto = req.body;
      await this.authService.forgotPin(ForgotPasswordData);
      res.status(200).json({ status: 'success', message: "Operation successful" });

    } catch (err) {
      next(err);
    }
  };

  public logOut = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userData: User = req.user;
      const logOutUserData: User = await this.authService.logout(userData);

      res.setHeader('Set-Cookie', ['Authorization=; Max-age=0']);
      res.status(200).json({ data: logOutUserData, message: 'logout' });
    } catch (error) {
      next(error);
    }
  };
}

export default AuthController;
