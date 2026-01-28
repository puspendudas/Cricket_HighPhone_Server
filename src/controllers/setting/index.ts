import { NextFunction, Request, Response } from 'express';
import SettingService from '@/services/setting.service';
import { MaintainenceDto, MerchantQrDto, MerchantUPIDto, UpdateSettingDto, UpdateWithdrawlOffDto } from '@/dtos/setting.dto';

class SettingController {
  public settingService: SettingService;

  constructor() {
    this.settingService = new SettingService();
  }

  public toggleAutoActive = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settingData = await this.settingService.toggleAutoActive();
      res.status(200).json({ status: "success", message: 'Toggle successful', data: settingData.auto_verified });
    } catch (error) {
      next(error);
    }
  };

  public toggleWebActive = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settingData = await this.settingService.toggleWebActive();
      res.status(200).json({ status: "success", message: 'Toggle successful', data: settingData.webtoggle });
    } catch (error) {
      next(error);
    }
  };

  public toggleAutoDeclare = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settingData = await this.settingService.toggleAutoDeclare();
      res.status(200).json({ status: "success", message: 'Toggle successful', data: settingData.auto_declare });
    } catch (error) {
      next(error);
    }
  };

  public getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settingsData = await this.settingService.getSettings();
      res.status(200).json({ status: "success", data: settingsData });
    } catch (error) {
      next(error);
    }
  };

  public updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updateData: UpdateSettingDto = req.body;

      const result = await this.settingService.updateSettings(updateData);
      
      res.status(200).json({ status: "success", message: "Update operation successful", data: result });
    } catch (error) {
      next(error);
    }
  };

  public sendotp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.settingService.sendotp();

      res.status(201).json({ status:'success', message: 'Send OTP successfully' });
    } catch (error) {
      next(error);
    }
  };

  public merchantChange = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updateData: MerchantUPIDto = req.body;
      const response = await this.settingService.changeMerchantUPI(updateData);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public merchantQr = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const merchantQrdata: MerchantQrDto = req.body;
      
      const message = await this.settingService.processMerchantQr(merchantQrdata, req);
      res.status(200).json({ status: "success", message });
    } catch (error) {
      next(error);
    }
  };

  public updateMaintenanceMode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const  maintenanceData:  MaintainenceDto = req.body;

      await this.settingService.updateMaintenanceMode(maintenanceData);

      res.json({ message: 'Maintenance mode updated successfully.' });
    } catch (err) {
      next(err);
    }
  };

  public toggleNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.settingService.toggleNotification();
      res.status(200).json({ status: 'success', message: "toggle operation success" });

    } catch (err) {
      next(err);
    }
  };

  public toggleWithdrawlOff = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const WithdrawlOffData: UpdateWithdrawlOffDto = req.body;
      const setting = await this.settingService.toggleWithdrawlOff(WithdrawlOffData);
      res.status(200).json({ status: 'success', message: "toggle operation success", data: setting.withdrawl_off_day });

    } catch (err) {
      next(err);
    }
  };

}

export default SettingController;