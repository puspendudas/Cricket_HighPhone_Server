import { HttpException } from '@exceptions/HttpException';
import { OTP_key, PHONE_NUMBER } from '@/config';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { isEmpty } from '@utils/util';
import TransactionModel from '@/models/transaction.model';
import SettingModel from '@/models/setting.model';
import UserModel from '@/models/user.model';
import { SettingRespond } from '@/interfaces/setting.interface';
import { MaintainenceDto, MerchantQrDto, MerchantUPIDto, UpdateSettingDto, UpdateWithdrawlOffDto } from '@/dtos/setting.dto';
const maintenanceFilePath = path.join(__dirname,'..','..', 'maintenance.json');

class SettingService {
  public transactionModel = TransactionModel;
  public settingsModel = SettingModel;
  public usersModel = UserModel;

  public async toggleAutoActive(): Promise<SettingRespond> {
    const foundSetting = await this.settingsModel.findOne({ name: 'global' });

    if (!foundSetting) {
      throw new HttpException(400, "Setting found for the id");
    }
    foundSetting.auto_verified = !foundSetting.auto_verified;
    await foundSetting.save();
    return foundSetting
  }

  public async toggleWebActive(): Promise<SettingRespond> {
    const foundSetting = await this.settingsModel.findOne({ name: 'global' });

    if (!foundSetting) {
      throw new HttpException(400, "Setting found for the id");
    }
    foundSetting.webtoggle = !foundSetting.webtoggle;
    await foundSetting.save();
    return foundSetting
  }

  public async toggleAutoDeclare(): Promise<SettingRespond> {
    const foundSetting = await this.settingsModel.findOne({ name: 'global' });

    if (!foundSetting) {
      throw new HttpException(400, "Setting found for the id");
    }
    foundSetting.auto_declare = !foundSetting.auto_declare;
    await foundSetting.save();
    return foundSetting
  }

  public async getSettings(): Promise<SettingRespond | null> {
    const settingsDoc = await this.settingsModel.findOne({ name: 'global' }).select("-authentication");
    if (!settingsDoc) {
      throw new HttpException(400, "Setting found for the id");
    }
    return settingsDoc;
  }

  public async updateSettings(updateData: UpdateSettingDto): Promise<void> {
    try {
      // Fetch the global settings
      const data = await this.settingsModel.findOne({ name: 'global' });
  
      if (!data) {
        throw new HttpException(404, "Settings not found");
      }
  
      // Clean up undefined fields from updateData
      const cleanedUpdateData = Object.keys(updateData).reduce((acc, key) => {
        if (updateData[key] !== undefined) {
          acc[key] = updateData[key];
        }
        return acc;
      }, {} as UpdateSettingDto);
  
      // Update the main settings fields
      Object.keys(cleanedUpdateData).forEach(key => {
        if (data[key] !== undefined) {
          data[key] = cleanedUpdateData[key];
        }
      });
  
      // Update rates fields separately, if provided
      if (updateData.starline !== undefined) data.rates.starline = updateData.starline;
      if (updateData.main !== undefined) data.rates.main = updateData.main;
      if (updateData.galidisawar !== undefined) data.rates.galidisawar = updateData.galidisawar;
  
      // Save the updated settings
      await data.save();
    } catch (error) {
      console.error(error);
      throw new HttpException(500, "Internal server error");
    }
  }

  public async sendotp(): Promise<any> {
    const data = await this.settingsModel.findOne({ name: 'global' });
    const phoneNumber = PHONE_NUMBER

    const otpData = await this.otpGenarate(phoneNumber);
    data.authentication.otp = String(otpData)
    const current_time = new Date()
    data.authentication.time = current_time
    await data.save()

    return otpData;
  }

  public async changeMerchantUPI(updateData: MerchantUPIDto): Promise<any> {
    if (isEmpty(updateData)) throw new HttpException(400, 'Merchant Data is empty');
    const data = await this.settingsModel.findOne({ name: "global" });
    if (!data) {
      throw new HttpException(404, "Global settings not found");
    }
    const five_min_ago = new Date(Date.now() - 5 * 60 * 1000);
    if (updateData.otp !== data.authentication.otp) {
      throw new HttpException(401, "Invalid OTP");
    }
    if (data.authentication.time >= five_min_ago) {
      data.merchant_upi = updateData.merchant_upi;
      data.merchant_name = updateData.merchant_name;
      data.authentication.otp = '';
      await data.save();
      return { status: "success", message: "Merchant upi change successfully" };
    } else {
      throw new HttpException(408, "OTP expired");
    }
  }

  // public async otpGenarate(phoneNumber): Promise<string> {

  //   const otp = Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;

  //   const data = {
  //     variables_values: String(otp),
  //     route: "otp",
  //     numbers: phoneNumber
  //   }
  //   try {
  //     const response = await axios.post("https://www.fast2sms.com/dev/bulkV2", data, {
  //       headers: {
  //         authorization: OTP_key,
  //         "Content-Type": "application/x-www-form-urlencoded"
  //       }
  //     });
  //     if (response.data.return) {
  //       return String(otp); // Return the generated OTP
  //     } else {
  //       throw new HttpException(500, `Failed to generate OTP: '${response.data.message}'`);
  //     }
  //   } catch (error) {
  //     console.error('Error:', error.response);
  //     throw new HttpException(500, `Failed to generate OTP: '${error.response.data.message}'`);
  //   }
  // }

  public async otpGenarate(phoneNumber): Promise<string> {
    const min = 100000;
    const max = 999999;
    const otp = Math.floor(Math.random() * (max - min + 1)) + min;
  
    const key = OTP_key;
    const route = "TRANS";
    const number = phoneNumber;
    const sender = "ANYPEY";
    const sms = `Your one time password(OTP) is ${otp}. Please do not share this with anyone, thank you. ANYPE.`;
  
    try {
      const url = `http://sms.pearlsms.com/public/sms/send`;
      
      const response = await axios.get(url, {
        params: {
          sender: sender,
          smstype: route,
          numbers: number,
          apikey: key,
          message: sms
        }
      });
  
      console.log("SMS API Response:", response.data);
  
      if (response.data.statuscode === 200) {
        return String(otp);
      } else {
        console.error('SMS API Error:', response.data.errormsg);
        throw new HttpException(500, `Failed to generate OTP: '${response.data.errormsg}'`);
      }
  
    } catch (error: any) {
      console.error('Axios Error:', error?.message || error);
      throw new HttpException(500, `Failed to generate OTP: '${error?.message || error}'`);
    }
  }

  public async processMerchantQr(merchantQrdata: MerchantQrDto, files?: any) {
    if (isEmpty(merchantQrdata && files)) throw new HttpException(400, 'Merchant Data is empty');
    const { otp } = merchantQrdata;
    const data = await this.settingsModel.findOne({ name: "global" });

    if (!data) {
      throw new HttpException(500, "Settings not found");
    }

    const fiveMinAgo = new Date(Date.now() - 10 * 60 * 1000);

    if (otp !== data.authentication.otp) {
      data.authentication.otp = "";
      throw new HttpException(400, "OTP invalid");
    }

    if (data.authentication.time < fiveMinAgo) {
      data.authentication.otp = "";
      throw new HttpException(400, "OTP expired");
    }
    await data.save();

    if (!files || !files.image) {
      throw new HttpException(400, "Need an image");
    }

    if (Array.isArray(files.image)) {
      throw new HttpException(400, "Only one file upload is permitted");
    }

    const { image } = files;
    const imageName = image.name;
    const imageDir = path.join(__dirname, '../public/qr');
    const link = "qr" + path.extname(imageName);

    fs.mkdirSync(imageDir, { recursive: true });
    const filepath = path.join(imageDir, link);
    await image.mv(filepath);

    data.merchant_qr = link;
    await data.save();

    return "Merchant QR added";
  }

  public async updateMaintenanceMode(maintenanceData: MaintainenceDto): Promise<void> {
    if (isEmpty(maintenanceData)) throw new HttpException(400, 'marketData is empty');
    const data: any = await this.settingsModel.findOne({ name: 'global' }).select("maintainence maintainence_msg app_version app_version_req");
    
    const updatedFields = ['maintainence', 'maintainence_msg', 'app_version', 'app_version_req'];
    updatedFields.forEach(field => {
        if (maintenanceData[field] !== undefined) {
            data[field] = maintenanceData[field];
        }
    });
    await data.save();    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...sanitizedData } = data.toObject();
    return new Promise((resolve, reject) => {
      fs.writeFile(maintenanceFilePath, JSON.stringify({ sanitizedData }), 'utf8', (err) => {
        if (err) {
          reject(new HttpException(500, 'Unable to update maintenance file'));
        } else {
          resolve();
        }
      });
    });
  }

  public async toggleNotification(): Promise<any> {
    // if (isEmpty(userToggleData)) throw new HttpException(400, 'maket Data is empty');
    const settingData = await this.settingsModel.findOne({ name: "global" });
    if (!settingData) { throw new HttpException(400, "Please restart the system !!!"); }
    settingData.auto_notification = !settingData.auto_notification
    await settingData.save();
    return settingData
  }

  public async toggleWithdrawlOff(WithdrawlOffData: UpdateWithdrawlOffDto): Promise<SettingRespond> {
    if (isEmpty(WithdrawlOffData)) throw new HttpException(400, 'Toggle Data is empty');
    const settingData = await this.settingsModel.findOne({ name: "global" });
    if (!settingData) { throw new HttpException(400, "No setting found"); }
    const toggleMap = {
      "monday": "monday",
      "tuesday": "tuesday",
      "wednesday": "wednesday",
      "thursday": "thursday",
      "friday": "friday",
      "saturday": "saturday",
      "sunday": "sunday",
    };

    const toggle = WithdrawlOffData.toggle;
    if (toggleMap.hasOwnProperty(toggle)) {
      settingData.withdrawl_off_day[toggleMap[toggle]] = !settingData.withdrawl_off_day[toggleMap[toggle]];
    }
    await settingData.save();
    return settingData
  }

}

export default SettingService;
