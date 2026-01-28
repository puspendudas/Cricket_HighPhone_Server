import { model, Schema } from 'mongoose';
import { SettingDocument } from '@/interfaces/setting.interface';

const settingSchema = new Schema<SettingDocument>(
  {
    name: { type: String, unique: true, default: "global" },
    referral_bonus: { type: Number, default: 0 },
    joining_bonus: { type: Number, default: 0 },
    merchant_name: { type: String, default: '-' },
    merchant_upi: { type: String, default: '-' },
    deposit: {
        min: { type: Number, default: 100 },
        max: { type: Number, default: 999999 }
    },
    withdraw: {
        min: { type: Number, default: 100 },
        max: { type: Number, default: 99999 }
    },
    transfer: {
        min: { type: Number, default: 100 },
        max: { type: Number, default: 9999999 }
    },
    betting: {
        min: { type: Number, default: 10 },
        max: { type: Number, default: 9999 }
    },
    withdrawl_off_day: {
        "monday": { type: Boolean, default: true },
        "tuesday": { type: Boolean, default: true },
        "wednesday": { type: Boolean, default: true },
        "thursday": { type: Boolean, default: true },
        "friday": { type: Boolean, default: true },
        "saturday": { type: Boolean, default: true },
        "sunday": { type: Boolean, default: true } 
      },
    withdraw_open: { type: String, default: '-' },
    withdraw_close: { type: String, default: '-' },
    rates: { starline: {}, main: {}, galidisawar: {} },
    app_link: { type: String, default: '-' },
    web_app_link: { type: String, default: '-' },
    web_link: { type: String, default: '-' },
    share_message: { type: String, default: '-' },
    maintainence: { type: Boolean, default: false },
    maintainence_msg: { type: String, default: '-' },
    app_version: { type: String, default: '-' },
    app_version_req: { type: Boolean, default: false },
    webtoggle: { type: Boolean, default: false },
    mobile: { type: String, default: '-' },
    telegram: { type: String, default: '-' },
    auto_verified: { type: Boolean, default: false },
    auto_notification: { type: Boolean, default: true },
    auto_declare: { type: Boolean, default: true },
    merchant_qr: { type: String, default: "-" },
    whatsapp: { type: String, default: '-' },
    whatsapp_text: { type: String, default: '-' },
    email_1: { type: String, default: '-' },
    email_2: { type: String, default: '-' },
    facebook: { type: String, default: '-' },
    twitter: { type: String, default: '-' },
    youtube: { type: String, default: '-' },
    instagram: { type: String, default: '-' },
    privacy_policy: { type: String, default: '-' },
    welcome_text: { type: String, default: 'The real name of this game is Satta Matka' },
    video_link: { type: String, default: '-' },
    upi_pay: { type: Boolean, default: true },
    qr_pay: { type: Boolean, default: true },
    tags: [],
    authentication: {
        otp: { type: String, default: '-' },
        time: { type: Date, default: '' }
    },
    reset_time: { type: String, default: '05:00' },
  }
);

const SettingModel = model<SettingDocument>('Setting', settingSchema);

export default SettingModel;
