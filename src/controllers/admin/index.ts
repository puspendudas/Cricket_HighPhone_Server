import { NextFunction, Request, Response } from 'express';
import { RequestWithUser } from '@interfaces/auth.interface';
import { AdminChangeMobileDto, AdminChangePasswordDto, UpdateAdminDto, AgentChangePasswordDto, CreateAdminDto, GetAgentDto, GetAllAdminDto, MobileLoginAdminDto, ToggleAdminDto, UpdateAgentDto, UpdateByAgentDto, UpdateLimitDto, ToggleAllAdminDto } from '@/dtos/admin.dto';
import AdminService from '@/services/admin.service';
import { Admin } from '@/interfaces/admin.interface';
import AdminModel from '@/models/admin.model';
class AdminController {
  public admin = AdminModel;
  public adminService: AdminService;

  constructor() {
    this.adminService = new AdminService();
  }

  public signUp = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {

      const adminData: CreateAdminDto = req.body;

      const parent = await this.adminService.findAdminById(adminData.parent_id);

      const signUpAdminData = await this.adminService.signup(adminData, parent);

      res.status(201).json({ data: { user_name: signUpAdminData.user_name, mobile: signUpAdminData.mobile, type: signUpAdminData.type }, message: 'signup' });
    } catch (error) {
      next(error);
    }
  };

  public updateAgent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminData: UpdateAgentDto = req.body;
      const signUpAdminData = await this.adminService.updateAgent(adminData);

      res.status(200).json({ data: { user_name: signUpAdminData.user_name, mobile: signUpAdminData.mobile, type: signUpAdminData.type }, message: 'Update successful' });
    } catch (error) {
      next(error);
    }
  };

  public updateByAgent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminData: UpdateByAgentDto = req.body;
      const signUpAdminData = await this.adminService.updateByAgent(adminData);

      res.status(200).json({ data: { user_name: signUpAdminData.user_name, mobile: signUpAdminData.mobile, type: signUpAdminData.type }, message: 'Update successful' });
    } catch (error) {
      next(error);
    }
  };

  public getId = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const adminType = req.params.type;
      const typePrefixMap: Record<string, string> = {
        admin: 'ADM',
        super_master: 'SUM',
        master: 'MAS',
        super_agent: 'SUA',
        agent: 'AGT',
      };
      const prefix = typePrefixMap[adminType];

      if (!prefix) {
        return res.status(400).json({ message: 'Invalid admin type' });
      }

      // Strict regex: match only properly formatted usernames (e.g., ADM001)
      const regex = new RegExp(`^${prefix}(\\d{3})$`, 'i');

      // Find all matching usernames from DB
      const admins = await AdminModel.find({ user_name: { $regex: regex } })
        .select('+user_name')
        .lean();

      // Extract and parse numbers
      const numbers = admins
        .map(a => {
          const match = a.user_name?.match(regex);
          return match?.[1] ? parseInt(match[1], 10) : null;
        })
        .filter((n): n is number => n !== null);

      const maxNumber = numbers.length ? Math.max(...numbers) : 0;
      const nextNumber = maxNumber + 1;

      const nextUserName = `${prefix}${String(nextNumber).padStart(3, '0')}`;

      return res.status(200).json({ user_name: nextUserName });

    } catch (error) {
      next(error)
    }
  }

  public logIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminData: MobileLoginAdminDto = req.body;
      const { cookie, tokenData, findAdmin } = await this.adminService.login(adminData);

      res.setHeader('Set-Cookie', [cookie]);
      res.status(200).json({
        message: 'Login SuccessFull',
        tokenData,
        data: findAdmin,
      });
    } catch (error) {
      next(error);
    }
  };

  public updateAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminData: UpdateAdminDto = req.body;
      await this.adminService.updateAdmin(adminData);

      res.status(200).json({ status: 'success', message: "Update successful" });
    } catch (error) {
      next(error);
    }
  };

  public getMe = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const adminData: Admin = req.body.admin;
      const lockContext = await this.adminService.getAdminLockContext(adminData._id.toString());
      res.status(200).json({ message: 'Check SuccessFull', data: adminData, lockStatus: lockContext });
    } catch (error) {
      next(error);
    }
  };

  public logOut = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const adminData: Admin = req.admin;
      const logOutAdminData: Admin = await this.adminService.logout(adminData);

      res.setHeader('Set-Cookie', ['Authorization=; Max-age=0']);
      res.status(200).json({ data: logOutAdminData, message: 'logout' });
    } catch (error) {
      next(error);
    }
  };

  public getAllAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminData: Admin = req.body.admin;
      const queryDto: GetAllAdminDto = req.query;
      const result = await this.adminService.getAllAdmin(queryDto, adminData);
      res.status(200).json({ status: 'success', ...result });
    } catch (error) {
      next(error);
    }
  };

  public updateAdminLimit = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const limitData: UpdateLimitDto = req.body;
      const adminData: Admin = req.admin;
      const result = await this.adminService.updateAdminLimit(limitData, adminData);
      res.status(200).json({ status: 'success', ...result });
    } catch (error) {
      next(error);
    }
  };


  public getAllAdminUserCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminData: Admin = req.body.admin;
      const result = await this.adminService.getHierarchyCounts(adminData);
      res.status(200).json({ status: 'success', ...result });
    } catch (error) {
      next(error);
    }
  };

  public getAgent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queryDto: GetAgentDto = req.query;
      const result = await this.adminService.getAgent(queryDto);
      res.status(200).json({ status: 'success', ...result });
    } catch (error) {
      next(error);
    }
  };

  public changeAdminPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminData: AdminChangePasswordDto = req.body;
      const result = await this.adminService.changeAdminPassword(adminData);
      res.status(200).json({ status: 'success', ...result });
    } catch (error) {
      next(error);
    }
  };

  public changeAgentPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminData: AgentChangePasswordDto = req.body;
      const result = await this.adminService.changeAgentPassword(adminData);
      res.status(200).json({ status: 'success', ...result });
    } catch (error) {
      next(error);
    }
  };

  public changeAdminMobile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminData: AdminChangeMobileDto = req.body;
      const result = await this.adminService.changeAdminMobile(adminData);
      res.status(200).json({ status: 'success', ...result });
    } catch (error) {
      next(error);
    }
  };

  public toggleAgentStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminToggleData: ToggleAdminDto = req.body;
      await this.adminService.toggleAgentStatus(adminToggleData);
      res.status(200).json({ status: 'success', message: "toggle operation success" });
    } catch (err) {
      next(err);
    }
  };

  public toggleAdminStatusAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminToggleData: ToggleAllAdminDto = req.body;
      await this.adminService.toggleAdminStatusAll(adminToggleData);
      res.status(200).json({ status: 'success', message: "toggle operation success" });
    } catch (err) {
      next(err);
    }
  };

  public toggleAgentTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminToggleData: ToggleAdminDto = req.body;
      await this.adminService.toggleAgentTransfer(adminToggleData);
      res.status(200).json({ status: 'success', message: "toggle operation success" });
    } catch (err) {
      next(err);
    }
  };

  public deleteAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = req.params.id;
      await this.adminService.deleteAdmin(adminId);

      res.status(200).json({ status: 'success', message: "Delete successful" });
    } catch (error) {
      next(error);
    }
  };

  public async initializeAdminAndSettings(req: Request, res: Response, next: NextFunction) {
    try {
      await this.adminService.initializeAdminAndSettings();
      res.status(200).json({ message: 'Admin and settings initialized successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export default AdminController;
