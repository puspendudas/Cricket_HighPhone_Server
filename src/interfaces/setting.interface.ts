import { Document } from 'mongoose';

interface Setting {
  id?: any;
  name: string;
  referral_bonus: number;
  joining_bonus: number;
  merchant_name: string;
  merchant_upi: string;
  deposit: any;
  withdraw: any;
  transfer: any;
  betting: any;
  withdraw_open: string;
  withdraw_close: string;
  offers: any;
  rates: any;
  app_link: string;
  web_app_link: string;
  web_link?: string;
  share_message: string;
  maintainence: boolean;
  app_version_req: boolean;
  upi_pay: boolean;
  qr_pay: boolean;
  maintainence_msg: string;
  app_version: string;
  account_holder: string;
  account_number: string;
  account_ifsc: string;
  google_id: string;
  phonepe_id: string;
  other_id: string;
  mobile: string;
  telegram: string;
  auto_verified: boolean;
  webtoggle: boolean;
  auto_notification: boolean;
  auto_declare: boolean;
  merchant_qr: string;
  whatsapp: string;
  whatsapp_text: string;
  landline_1: string;
  landline_2: string;
  email_1: string;
  email_2: string;
  facebook: string;
  twitter: string;
  youtube: string;
  instagram: string;
  privacy_policy: string;
  welcome_text: string;
  video_link: string;
  tags: any;
  authentication: any;
  withdrawl_off_day: any;
  reset_time: string;
  last_checked_date: string;
  comparison_done_today: boolean;
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface SettingDocument extends Setting, Document {
  id: string;
}

interface SettingRespond {
  name?: string;
  referral_bonus?: number;
  joining_bonus?: number;
  merchant_name?: string;
  merchant_upi?: string;
  deposit?: any;
  withdraw?: any;
  transfer?: any;
  betting?: any;
  withdraw_open?: string;
  withdraw_close?: string;
  rates?: any;
  app_link?: string;
  web_app_link?: string;
  web_link?: string;
  upi_pay: boolean;
  qr_pay: boolean;
  share_message?: string;
  maintainence?: boolean;
  app_version_req?: boolean;
  webtoggle?: boolean;
  maintainence_msg?: string;
  app_version?: string;
  account_holder?: string;
  account_number?: string;
  account_ifsc?: string;
  google_id?: string;
  phonepe_id?: string;
  other_id?: string;
  mobile?: string;
  telegram?: string;
  auto_verified?: boolean;
  auto_notification: boolean;
  auto_declare?: boolean;
  merchant_qr: string;
  whatsapp?: string;
  whatsapp_text?: string;
  landline_1?: string;
  landline_2?: string;
  email_1?: string;
  email_2?: string;
  facebook?: string;
  twitter?: string;
  youtube?: string;
  instagram?: string;
  privacy_policy?: string;
  welcome_text?: string;
  video_link?: string;
  tags?: any;
  authentication?: any;
  withdrawl_off_day?: any;
  reset_time?: string;
  last_checked_date?: string;
  comparison_done_today?: boolean;
}


export { Setting, SettingDocument, SettingRespond };
