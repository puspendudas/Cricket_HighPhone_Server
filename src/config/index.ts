import { config } from 'dotenv';
config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });
export const { DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE } = process.env;
export const CREDENTIALS = process.env.CREDENTIALS === 'true';
export const DB_URL = `mongodb+srv://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${DB_DATABASE}`;
export const { NODE_ENV, PORT, APP_SECRET_KEY, ADMIN_SECRET_KEY, AGENT_SECRET_KEY, LOG_FORMAT, LOG_DIR, ORIGIN_LOCAL, ORIGIN_CRICKET, ORIGIN_LIVE, ORIGIN_SATTA, ORIGIN_LOCAL_1, ORIGIN_LOCAL_2, ORIGIN_SATTA_1, ORIGIN_LIVE_1, ORIGIN_ANDROID_APP, ORIGIN_IOS_APP } = process.env;
export const ADMIN_TYPES = ['super_admin', 'admin','super_master', 'master', 'super_agent', 'agent']
export const GAME_MODES = ["single-digit", "double-digit", "single-panna", "double-panna", "triple-panna", "even-odd-digit", "full-sangum", "half-sangum",
    "sp-dp-tp", "cycle-panna", "sp-mortor", "dp-mortor", "double-even-odd", "left-digit", "jodi-digit", "right-digit", "jodi-bulk", "single-panna-bulk",
    "double-panna-bulk"]
export const SUB_MODES = ["sp", "dp", "tp"]
export const GAME_TYPES = ["main", "starline", "galidisawar"]
export const GAME_SESSION = ["close", "open", "-"]
export const BET_STATUS = ["running", "closed", "cancelled"]
export const OTP_key = process.env.OTP_KEY
export const GAME_OFF = process.env.GAME_OFF
export const TRANSACTION_TYPES = ["bet", "mobile", "referral", "admin", "agent", "bonus", "a_admin", "a_agent" ]
export const TRANSACTION_TRANSFER_TYPES = ["win", "lose", "deposit", "withdrawal", "user_transfer", "upi"]
export const TRANSACTION_STATUS = ["pending", "completed", "cancelled", "success", "failure"]
export const PHONE_NUMBER = process.env.PHONE_NO

//super_admin'->  'admin'-> 'super_master'->  'master'->  'super_agent' -> 'agent' -> 'user'
