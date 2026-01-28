import { NextFunction, Request, Response } from 'express';
import { ChangePassUserDto, ChangePasswordUserDto, ChangePinUserDto, CreateClientDto, GetAllUserDto, ToggleUserDto, ToggleUserNotiDto, UpdateUserAllMatchLockDto, UpdateUserDto, UpdateUserMatchLockDto, UpdateUserRateDiffDto, UpdateUserStackDto } from '@dtos/users.dto';
import { GetAllUserQuery, User } from '@interfaces/users.interface';
// import { logger } from '@utils/logger';
import { QUIZE_DATA } from '@/store/quiz';
import UserService from '@services/user.service';
import ConvertResponds from '@functions/converResponts';
import AdminService from '@/services/admin.service';
import UserModel from '@/models/user.model';
import { RequestWithUser } from '@/interfaces/auth.interface';
import { Admin } from '@/interfaces/admin.interface';
import { UpdateLimitDto } from '@/dtos/admin.dto';

class UsersController {
  public users = UserModel;
  public userServices: UserService;
  public convertResponds: ConvertResponds;
  public adminService: AdminService;

  constructor() {
    this.userServices = new UserService();
    this.adminService = new AdminService();
    this.convertResponds = new ConvertResponds();
  }

  public getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.id;
      const findOneUserData: User = await this.userServices.findUserById(userId);

      res.status(200).json({ status: 'success', data: findOneUserData });
    } catch (error) {
      next(error);
    }
  };

  public createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: CreateClientDto = req.body;

      const agent = await this.adminService.findAdminById(userData.agent_id);

      const newUser = await this.userServices.createUser(userData, agent);

      res.status(200).json({ status: 'success', message: "Create successful", data: newUser });
    } catch (error) {
      next(error);
    }
  };

    public changeUserPassword = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.userId;
      const userDataBeforeChange: ChangePasswordUserDto = req.body;
      const userDataAfterChange = await this.userServices.changeUserPassword(userDataBeforeChange, userId);
      res.status(200).json({ message: userDataAfterChange });
    } catch (error) {
      next(error);
    }
  };

  public updateUserRateDiff = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: UpdateUserRateDiffDto = req.body;
      await this.userServices.updateUserRateDiff(userData);

      res.status(200).json({ status: 'success', message: "Update successful" });
    } catch (error) {
      next(error);
    }
  };

    public updateUserStack = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: UpdateUserStackDto = req.body;
      await this.userServices.updateUserStack(userData);

      res.status(200).json({ status: 'success', message: "Stack updated successful" });
    } catch (error) {
      next(error);
    }
  };

  public deleteUserStack = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: UpdateUserStackDto = req.body;
      await this.userServices.deleteUserStack(userData);

      res.status(200).json({ status: 'success', message: "Stack deleted successful" });
    } catch (error) {
      next(error);
    }
  };

  public getUserStack = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.userId;
      const stack = await this.userServices.getUserStack(userId);

      res.status(200).json({ status: 'success', message: "Stack fetched successful", data: stack });
    } catch (error) {
      next(error);
    }
  };

  public updateUserMatchBmLock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: UpdateUserMatchLockDto = req.body;
      await this.userServices.updateUserMatchBmLock(userData);

      res.status(200).json({ status: 'success', message: "BM lock updated successful" });
    } catch (error) {
      next(error);
    }
  };

  public updateUserAllMatchBmLock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: UpdateUserAllMatchLockDto = req.body;
      await this.userServices.updateUserAllMatchBmLock(userData);

      res.status(200).json({ status: 'success', message: "All BM lock updated successful" });
    } catch (error) {
      next(error);
    }
  };

  public updateUserMatchFancyLock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: UpdateUserMatchLockDto = req.body;
      await this.userServices.updateUserMatchFancyLock(userData);

      res.status(200).json({ status: 'success', message: "Fancy lock updated successful" });
    } catch (error) {
      next(error);
    }
  };

  public updateUserAllMatchFancyLock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: UpdateUserAllMatchLockDto = req.body;
      await this.userServices.updateUserAllMatchFancyLock(userData);

      res.status(200).json({ status: 'success', message: "All Fancy lock updated successful" });
    } catch (error) {
      next(error);
    }
  };

  public updateUserLimit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: UpdateLimitDto = req.body;
      await this.userServices.updateUserLimit(userData);
      res.status(200).json({ status: 'success', message: "Limit updated successful" });
    } catch (error) {
      next(error);
    }
  };

  public getClientId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prefix = 'CLT';
      const regex = new RegExp(`^${prefix}(\\d{3})$`, 'i');

      const clients = await this.users.find({ user_name: { $regex: regex } })
        .select('+user_name')
        .lean();

      const numbers = clients
        .map(c => {
          const match = c.user_name?.match(regex);
          return match?.[1] ? parseInt(match[1], 10) : null;
        })
        .filter((n): n is number => n !== null);

      const maxNumber = numbers.length ? Math.max(...numbers) : 0;
      const nextNumber = maxNumber + 1;

      const nextUserName = `${prefix}${String(nextNumber).padStart(3, '0')}`;

      return res.status(200).json({ user_name: nextUserName });
    } catch (error) {
      next(error);
    }
  };

  public updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: UpdateUserDto = req.body;
      await this.userServices.updateUser(userData);

      res.status(200).json({ status: 'success', message: "Update successful" });
    } catch (error) {
      next(error);
    }
  };

  public deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.id;
      await this.userServices.deleteUser(userId);

      res.status(200).json({ status: 'success', message: "Delete successful" });
    } catch (error) {
      next(error);
    }
  };

  public getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminData: Admin = req.body.admin;
      const userData: GetAllUserDto = req.query;

      let query: GetAllUserQuery = {
        ...userData,
        verified: userData.verified ? userData.verified : true
      };

      if (userData.search) {
        query = {
          ...query,
          $or: [
            {
              user_name: { $regex: userData.search, $options: 'i' }
            },
            {
              mobile: { $regex: userData.search, $options: 'i' }
            }
          ],
        };
      }

      if (userData.from && userData.to) {
        query = {
          ...query,
          createdAt: {
            $gte: userData.from,
            $lt: userData.to
          }
        };
      }

      delete query.search
      delete query.from
      delete query.to

      const { users, total } = await this.userServices.getUsersUnderAdmin(adminData, query);
      // const { users, total } = await this.userServices.getAllUsers({ ... userData });
      res.status(200).json({ status: "success", message: 'All user data', total: total, data: users });
    } catch (error) {
      next(error);
    }
  };

  public getAllUsersApp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: GetAllUserDto = req.query;

      let query: GetAllUserQuery = {
        ...userData,
        verified: userData.verified ? userData.verified : true
      };

      if (userData.search) {
        query = {
          ...query,
          $or: [
            {
              user_name: { $regex: userData.search, $options: 'i' }
            },
            {
              mobile: { $regex: userData.search, $options: 'i' }
            }
          ],
        };
      }

      if (userData.from && userData.to) {
        query = {
          ...query,
          createdAt: {
            $gte: userData.from,
            $lt: userData.to
          }
        };
      }

      delete query.search
      delete query.from
      delete query.to

      const { users, total } = await this.userServices.getAllUsersApp(query);
      // const { users, total } = await this.userServices.getAllUsers({ ... userData });
      res.status(200).json({ status: "success", message: 'All user data', total: total, data: users });
    } catch (error) {
      next(error);
    }
  };

  public changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ChangePasswordData: ChangePassUserDto = req.body;
      await this.userServices.changePassword(ChangePasswordData);
      res.status(200).json({ status: 'success', message: "Operation successful" });

    } catch (err) {
      next(err);
    }
  };

  public changePin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ChangePinData: ChangePinUserDto = req.body;
      await this.userServices.changePin(ChangePinData);
      res.status(200).json({ status: 'success', message: "Operation successful" });

    } catch (err) {
      next(err);
    }
  };

  public toggleUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userToggleData: ToggleUserDto = req.body;
      await this.userServices.toggleUser(userToggleData);
      res.status(200).json({ status: 'success', message: "toggle operation success" });

    } catch (err) {
      next(err);
    }
  };

  public toggleUserNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userToggleData: ToggleUserNotiDto = req.body;
      await this.userServices.toggleUserNotification(userToggleData);
      res.status(200).json({ status: 'success', message: "toggle operation success" });

    } catch (err) {
      next(err);
    }
  };

  public getRandomQuiz = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const length: number = parseInt(req.params.length as string);
      const sourceArray = QUIZE_DATA
      const quizQuestions = await this.userServices.getRandomUniqueArray(length, sourceArray);
      res.status(200).json({ status: 'success', data: quizQuestions });
    } catch (error) {
      next(error);
    }
  };


}

export default UsersController;
