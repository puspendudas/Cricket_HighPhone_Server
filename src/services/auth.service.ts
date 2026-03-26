import { sign } from 'jsonwebtoken';
import axios from 'axios';
import { OTP_key, APP_SECRET_KEY } from '@/config';
import UserModel from '@models/user.model';
import { CreateUserDto, ForgotPassUserDto, ForgotPinUserDto, MobileLoginPassUserDto, MobileLoginPinUserDto, SendOtpUserDto, UserNameLoginPassUserDto, VerifyOtpUserDto } from '@dtos/users.dto';
import { HttpException } from '@exceptions/HttpException';
import { DataStoredInToken, TokenData } from '@interfaces/auth.interface';
import { User, UserLoginRespond } from '@interfaces/users.interface';
import { comparePassword, encrypt, isEmpty } from '@utils/util';
import SettingModel from '@/models/setting.model';
import TransactionModel from '@/models/transaction.model';
import AdminModel from '@/models/admin.model';
import { randomBytes } from 'crypto';
import mongoose from 'mongoose';

class AuthService {
  public users = UserModel;
  public settingsModel = SettingModel
  public transaction = TransactionModel
  public admin = AdminModel

  // public async signup(userData: CreateUserDto): Promise<User> {
  //   if (!userData || isEmpty(userData)) {
  //     throw new HttpException(400, 'User data is empty');
  //   }

  //   const existingUser = await this.users.findOne({ mobile: userData.mobile });
  //   if (existingUser) {
  //     throw new HttpException(409, `Mobile number ${userData.mobile} already exists`);
  //   }

  //   const settings = await this.settingsModel.findOne({ name: "global" });
  //   if (!settings) {
  //     throw new HttpException(500, 'Failed to retrieve global settings');
  //   }
  //   const { joining_bonus, auto_verified } = settings;

  //   const status = userData.user_name.trim().toLowerCase() === "john" || userData.mobile.startsWith("9154") ? false : auto_verified;

  //   const hashedMpin = encrypt(userData.mpin, 10);
  //   const hashedPassword = encrypt(userData.password, 10);
  //   const newUser = new this.users({
  //     ...userData,
  //     mpin: hashedMpin,
  //     password: hashedPassword,
  //     wallet: joining_bonus,
  //     status: status,
  //     betting: auto_verified,
  //     transfer: auto_verified,
  //     transaction: []  // Initialize as empty array
  //   });

  //   await newUser.save();

  //   if (joining_bonus > 0) {
  //     const newTransaction = new this.transaction({
  //       type: 'transfer',
  //       transfer_type: 'deposit',
  //       note: 'Joining bonus credited',
  //       status: 'completed',
  //       amount: joining_bonus,
  //       user_id: newUser._id,
  //       prev_balance: 0,
  //       current_balance: joining_bonus
  //     });

  //     await newTransaction.save();

  //     // Only save the transaction ID in the user document
  //     newUser.transaction.push(newTransaction._id);
  //     await newUser.save();
  //   }
  //   return newUser;
  // }

  public async signup(userData: CreateUserDto): Promise<User> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!userData || isEmpty(userData)) {
        throw new HttpException(400, 'User data is empty');
      }

      const referralLength = userData.referral_code !== undefined ? userData.referral_code.length : 0;
      const user_ref = referralLength === 8 ? userData.referral_code : undefined;
      const agent_ref = referralLength === 10 ? userData.referral_code : undefined;

      const existingUser = await this.users.findOne({ mobile: userData.mobile }).session(session);
      if (existingUser) {
        throw new HttpException(409, `User with mobile ${userData.mobile} already exists`);
      }

      let foundAdmin = null;
      if (agent_ref) {
        foundAdmin = await this.admin.findOne({ agent_code: agent_ref }).select("referrals status").session(session);
        if (!foundAdmin) {
          throw new HttpException(404, 'Agent code is invalid');
        }
        if (!foundAdmin.status) {
          throw new HttpException(403, 'Agent is inactive');
        }
      }

      const settings = await this.settingsModel.findOne({ name: "global" }).session(session);
      if (!settings) {
        throw new HttpException(404, 'Unable to retrieve global settings');
      }

      const { joining_bonus, auto_verified, referral_bonus } = settings;

      const generatedReferralCode = Array.from(randomBytes(8), byte => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(byte % 62)).join('');

      const status = userData.user_name.trim().toLowerCase() === "john" || userData.user_name.trim().toLowerCase() === "johndoe" || userData.mobile.startsWith("9154") || userData.mobile.startsWith("9159") ? false : auto_verified;

      const hashedMpin = userData.mpin ? encrypt(userData.mpin, 10) : undefined;
      const hashedPassword = userData.password ? encrypt(userData.password, 10) : undefined;

      const newUser = new this.users({
        user_name: userData.user_name,
        mobile: userData.mobile,
        mpin: hashedMpin,
        password: hashedPassword,
        fcm: userData.fcm,
        referral_code: generatedReferralCode,
        wallet: joining_bonus,
        status: status,
        // betting lock should be OFF by default (false = unlocked)
        betting: false,
        transfer: auto_verified,
        agent_id: foundAdmin ? foundAdmin._id : null,
      });

      const savedUser = await newUser.save({ session });

      if (joining_bonus > 0) {
        const newJoinTransaction = new this.transaction({
          type: 'referral',
          note: 'Joining bonus',
          status: 'completed',
          amount: joining_bonus,
          user: savedUser._id,
          prev_balance: 0,
          current_balance: savedUser.wallet,
        });

        await newJoinTransaction.save({ session });

        savedUser.transaction.push(newJoinTransaction._id);
        await savedUser.save({ session });
      }

      if (foundAdmin) {
        await this.admin.updateOne(
          { _id: foundAdmin._id },
          { $push: { referrals: savedUser._id } },
          { session }
        );
      }

      if (user_ref) {
        const referringUser = await this.users.findOne({ referral_code: user_ref }).select("wallet_ref transaction referrals").session(session);
        if (referringUser) {
          referringUser.referrals.push(savedUser._id);
          if (referral_bonus > 0) {
            referringUser.wallet += referral_bonus;
            const newRefTransaction = new this.transaction({
              type: 'referral',
              note: 'Referral bonus',
              status: 'completed',
              amount: referral_bonus,
              user: referringUser._id,
              prev_balance: referringUser.wallet - referral_bonus,
              current_balance: referringUser.wallet,
            });

            await newRefTransaction.save({ session });

            referringUser.transaction.push(newRefTransaction._id);
            await referringUser.save({ session });
          } else {
            await referringUser.save({ session });
          }
        }
      }

      await session.commitTransaction();
      session.endSession();

      return savedUser;

    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error('Error during user creation:', err);
      throw new HttpException(err.status, err.message);
    }
  }

  public async loginPin(userData: MobileLoginPinUserDto): Promise<{ cookie: string; tokenData: TokenData; findUser: UserLoginRespond }> {
    if (isEmpty(userData)) throw new HttpException(400, 'User Data is empty');

    const findUser = await this.users.findOne({ mobile: userData.mobile });

    if (!findUser) throw new HttpException(410, `This mobile ${userData.mobile} was not found`);
    const isPasswordMatching: boolean = comparePassword(userData.mpin, findUser.mpin, 10);
    if (!isPasswordMatching) throw new HttpException(409, 'Password not matching');

    if (userData.fcm !== undefined) findUser.fcm = userData.fcm;

    if (!findUser.verified) {
      await findUser.save();
      return { cookie: '', tokenData: {} as any, findUser };
    }

    const sessionToken = this.generateSessionToken();
    findUser.session_token = sessionToken;
    findUser.session_updated_at = new Date();
    await findUser.save();

    const tokenData = this.createToken(findUser, sessionToken);
    const cookie = this.createCookie(tokenData);

    return { cookie, tokenData, findUser };
  }

  public async loginPass(userData: MobileLoginPassUserDto): Promise<{ cookie: string; tokenData: TokenData; findUser: UserLoginRespond }> {
    if (isEmpty(userData)) throw new HttpException(400, 'User Data is empty');

    const findUser = await this.users.findOne({ mobile: userData.mobile });

    if (!findUser) throw new HttpException(410, `This mobile ${userData.mobile} was not found`);
    const isPasswordMatching: boolean = comparePassword(userData.password, findUser.password, 10);
    if (!isPasswordMatching) throw new HttpException(409, 'Password not matching');

    if (userData.fcm !== undefined) findUser.fcm = userData.fcm;

    if (!findUser.verified) {
      await findUser.save();
      return { cookie: '', tokenData: {} as any, findUser };
    }

    const sessionToken = this.generateSessionToken();
    findUser.session_token = sessionToken;
    findUser.session_updated_at = new Date();
    await findUser.save();

    const tokenData = this.createToken(findUser, sessionToken);
    const cookie = this.createCookie(tokenData);

    return { cookie, tokenData, findUser };
  }

  public async loginUserName(userData: UserNameLoginPassUserDto): Promise<{ cookie: string; tokenData: TokenData; findUser: UserLoginRespond }> {
    if (isEmpty(userData)) throw new HttpException(400, 'User Data is empty');

    const findUser = await this.users.findOne({ user_name: userData.user_name.toLocaleUpperCase() });

    if (!findUser) throw new HttpException(410, `This user name ${userData.user_name} was not found`);

    const isPasswordMatching: boolean = comparePassword(userData.password, findUser.password, 10);
    if (!isPasswordMatching) throw new HttpException(409, 'Password not matching');

    if (!findUser.status) throw new HttpException(403, 'User is inactive');

    if (userData.fcm !== undefined) findUser.fcm = userData.fcm;

    if (!findUser.verified || !findUser.status) {
      await findUser.save();
      return { cookie: '', tokenData: {} as any, findUser };
    }

    const sessionToken = this.generateSessionToken();
    findUser.session_token = sessionToken;
    findUser.session_updated_at = new Date();
    await findUser.save();

    const tokenData = this.createToken(findUser, sessionToken);
    const cookie = this.createCookie(tokenData);

    return { cookie, tokenData, findUser };
  }

  public async refreshToken(userData: User): Promise<{ cookie: string; tokenData: TokenData; findUser: UserLoginRespond }> {
    if (isEmpty(userData)) throw new HttpException(400, 'User Data is empty');

    const findUser = await this.users.findOne({ mobile: userData.mobile });
    if (!findUser) throw new HttpException(410, `This mobile ${userData.mobile} was not found`);

    const sessionToken = this.generateSessionToken();
    findUser.session_token = sessionToken;
    findUser.session_updated_at = new Date();
    await findUser.save();

    const tokenData = this.createToken(findUser, sessionToken);
    const cookie = this.createCookie(tokenData);

    return { cookie, tokenData, findUser };
  }

  public async logout(userData: User): Promise<User> {
    if (isEmpty(userData)) throw new HttpException(400, 'userData is empty');

    const findUser: User = await this.users.findOne({ mobile: userData.mobile });
    if (!findUser) throw new HttpException(409, "User doesn't exist");

    return findUser;
  }

  public async sendotp(userData: SendOtpUserDto): Promise<User> {
    if (isEmpty(userData)) throw new HttpException(400, 'userData is empty');

    const findUser: User = await this.users.findOne({ mobile: userData.mobile });
    if (!findUser) throw new HttpException(409, `This mobile ${userData.mobile} is not register.`);
    const otpData = await this.otpGenarate(findUser);

    const sendOtpData: User = await this.users.findByIdAndUpdate(findUser.id, { authentication: true, otp: otpData });

    return sendOtpData;
  }

  public async verifyotp(userData: VerifyOtpUserDto): Promise<{ cookie: string; tokenData: TokenData; findUser: User }> {
    if (isEmpty(userData)) throw new HttpException(400, 'userData is empty');
    const findUser: User = await this.users.findOne({ mobile: userData.mobile }).select("otp verified mobile otp_expiry");
    if (!findUser) throw new HttpException(409, `This mobile ${userData.mobile} is not register.`);
    const otp_expiry = new Date(Date.now() + 1000 * 60 * 5);
    if (findUser.otp_expiry < otp_expiry) {
      throw new HttpException(400, 'OTP is expired, please request for new OTP');
    }
    if (userData.otp === findUser.otp) {
      const sessionToken = this.generateSessionToken();
      await this.users.findByIdAndUpdate(findUser.id, {
        verified: true,
        otp: "-",
        session_token: sessionToken,
        session_updated_at: new Date(),
      });
      // findUser.verified = true
      // findUser.otp = "-"
      // await findUser.save()
      const tokenData = this.createToken(findUser, sessionToken);
      const cookie = this.createCookie(tokenData);

      return { cookie, tokenData, findUser };

    } else {
      throw new HttpException(409, `OTP is incorrect`);
    }
  }

  public async forgotPassword(ForgotPasswordData: ForgotPassUserDto): Promise<void> {
    if (isEmpty(ForgotPasswordData)) throw new HttpException(400, 'User Data is empty');
    const foundUser = await this.users.findOne({ mobile: ForgotPasswordData.mobile }).select("otp password updatedAt");
    if (!foundUser) throw new HttpException(400, "User not found for mobile");

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (foundUser.otp === ForgotPasswordData.otp && foundUser.updatedAt >= fiveMinAgo) {
      const hashedPassword = encrypt(ForgotPasswordData.password, 10);
      foundUser.password = hashedPassword;
    } else {
      throw new HttpException(400, foundUser.otp === ForgotPasswordData.otp ? "OTP expired" : "Invalid OTP");
    }
    await foundUser.save();
  }

  public async forgotPin(ForgotPinData: ForgotPinUserDto): Promise<void> {
    if (isEmpty(ForgotPinData)) throw new HttpException(400, 'User Data is empty');
    const foundUser = await this.users.findOne({ mobile: ForgotPinData.mobile }).select("otp mpin updatedAt");
    if (!foundUser) throw new HttpException(400, "User not found for mobile");

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (foundUser.otp === ForgotPinData.otp && foundUser.updatedAt >= fiveMinAgo) {
      const hashedMpin = encrypt(ForgotPinData.mpin, 10);
      foundUser.mpin = hashedMpin;
    } else {
      throw new HttpException(400, foundUser.otp === ForgotPinData.otp ? "OTP expired" : "Invalid OTP");
    }
    await foundUser.save();
  }

  private generateSessionToken(): string {
    return randomBytes(32).toString('hex');
  }

  public createToken(user: User, sessionToken?: string): TokenData {
    const dataStoredInToken: DataStoredInToken = { id: user.id };
    if (sessionToken) {
      dataStoredInToken.sessionToken = sessionToken;
    }
    const secretKey: string = APP_SECRET_KEY;
    const expiresIn = "1d";

    return { expiresIn, token: sign(dataStoredInToken, secretKey, { expiresIn }) };
  }

  public createCookie(tokenData: TokenData): string {
    return `Authorization=${tokenData.token}; HttpOnly; Max-Age=${tokenData.expiresIn};`;
  }

  // public async otpGenarate(user: User): Promise<string> { // Define return type as Promise<number>
  //   const min = 100000; // Minimum value for a 6-digit number
  //   const max = 999999; // Maximum value for a 6-digit number
  //   // const otp = "111111"
  //   const otp = Math.floor(Math.random() * (max - min + 1)) + min;

  //   const data = {
  //     variables_values: String(otp),
  //     route: "otp",
  //     numbers: user.mobile
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
  //       console.error('Error:', response.data);
  //       throw new HttpException(500, `Failed to generate OTP: '${response.data.message}'`);
  //     }
  //   } catch (error) {
  //     console.error('Error:', error.response);
  //     throw new HttpException(500, `Failed to generate OTP: '${error.response.data.message}'`);
  //   }
  // }

  public async otpGenarate(user: User): Promise<string> {
    const min = 100000;
    const max = 999999;
    const otp = Math.floor(Math.random() * (max - min + 1)) + min;

    const key = OTP_key;
    const route = "TRANS";
    const number = user.mobile;
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
        throw new HttpException(502, `Failed to generate OTP: '${response.data.errormsg}'`);
      }

    } catch (error: any) {
      console.error('Axios Error:', error?.message || error);
      throw new HttpException(502, `Failed to generate OTP: '${error?.message || error}'`);
    }
  }

  /**
   * Returns the effective global lock state for a user by walking up their admin hierarchy.
   * Used by the /me endpoint so the UI can disable betting UI immediately on login.
   */
  public async getUserEffectiveLockStatus(userId: string): Promise<{ effectiveBmLocked: boolean; effectiveFancyLocked: boolean }> {
    const user = await this.users.findById(userId).select('agent_id').lean();
    if (!user?.agent_id) return { effectiveBmLocked: false, effectiveFancyLocked: false };

    const adminIds: string[] = [];
    let currentId = user.agent_id.toString();

    while (true) {
      adminIds.push(currentId);
      const current = await this.admin.findById(currentId).select('parent_id').lean();
      if (!current?.parent_id) break;
      currentId = current.parent_id.toString();
    }

    const adminDocs = await this.admin.find({ _id: { $in: adminIds } }).select('bm_lock_status fancy_lock_status').lean();
    return {
      effectiveBmLocked: adminDocs.some((d: any) => d.bm_lock_status === true),
      effectiveFancyLocked: adminDocs.some((d: any) => d.fancy_lock_status === true),
    };
  }

}

export default AuthService;

