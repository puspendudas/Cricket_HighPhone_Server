import { Document, Types } from 'mongoose';

interface User {
  _id?: Types.ObjectId;
  id?: any;
  user_name: string;
  name: string;
  agent: any;
  mpin: string;
  password: string;
  email: string;
  mobile: string;
  wallet: number;
  rate_diff: number;
  stack: number[];
  verified: boolean;
  otp_verified: boolean;
  authentication: boolean;
  match_commission: number;
  session_commission: number;
  casino_commission: number;
  admin_id: any;
  agent_id: any;
  exposure: number;
  refresh_token: string;
  access_token: string;
  status: boolean;
  bm_lock: any[];
  fancy_lock: any[];
  referral_code: string;
  branch_name: string;
  bank_name: string;
  account_holder_name: string;
  account_no: string;
  ifsc_code: string;
  otp: string;
  otp_expiry: Date;
  upi_id: string;
  upi_number: string;
  betting: boolean;
  transfer: boolean;
  fcm: string;
  personal_notification: boolean;
  main_notification: boolean;
  starline_notification: boolean;
  galidisawar_notification: boolean;
  bets: any;
  transaction: any;
  notification: any;
  referral_by: any;
  referrals: any;
  updatedAt?: any
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface UserDocument extends User, Document {
  _id: Types.ObjectId;
  id: string;
}

interface UserRespond {
  user_name: string;
  email: string;
  mobile: string;
  wallet: number;
}

interface UserLoginRespond {
  mobile: string;
  id: string;
  verified: boolean;
}

interface SendOtpUser {
  mobile: string;
  otp: string;
}

interface GetAllUserQuery {
  status?: boolean;
  agent?: string;
  from?: string;
  to?: string;
  createdAt?: {
    $gte?: string,
    $lt?: string
  },
  search?: string;
  count?: number;
  skip?: number;
  verified?: boolean;
  $or?: [
    {
      user_name?: { $regex: string, $options: 'i' }
    },
    {
      mobile?: { $regex: string, $options: 'i' }
    }
  ]
}

export { User, UserDocument, UserRespond, SendOtpUser, GetAllUserQuery, UserLoginRespond };
