import { Document, Types } from 'mongoose';

interface Admin {
  _id?: Types.ObjectId;
  id?: any;
  user_name: string;
  name: string;
  app_access: boolean;
  web_access: boolean;
  email: string;
  password?: string;
  mobile?: string;
  status: boolean;
  transfer: boolean;
  tag_access: boolean;
  branch_name: string;
  bank_name: string;
  account_holder_name: string;
  account_no: string;
  ifsc_code: string;
  upi_id: string;
  upi_number: string;
  type: string;
  tag_list: any;
  market_list: any;
  parent_id: any;
  sub_admin_list: any;
  share: number;
  match_commission: number;
  session_commission: number;
  casino_commission: number;
  wallet: number;
  exposure: number;
  transaction: any;
  agent_code: string;
  referrals: any;
  bm_lock: any[];
  fancy_lock: any[];
  bm_lock_status: boolean;
  fancy_lock_status: boolean;
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface AdminDocument extends Admin, Document {
  _id: Types.ObjectId;
  id: string;
}

interface AdminRespond {
  user_name: string;
  name: string;
  email: string;
  mobile?: string;
}

export { Admin, AdminDocument, AdminRespond };
