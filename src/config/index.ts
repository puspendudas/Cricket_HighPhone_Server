import { config } from 'dotenv';
config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });
export const { DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE } = process.env;
export const CREDENTIALS = process.env.CREDENTIALS === 'true';
/** Used by sync-service only (Local → Atlas). Do not use for Mongoose — app reads/writes local replica set via DB_URL. */
export const ATLAS_DB_URL = process.env.ATLAS_DB_URL;

/** Primary Mongo URI for the API (reads + writes + terminal). Local replica set; sync-service pushes to ATLAS_DB_URL separately. */
export const DB_URL =
  process.env.DB_URL && process.env.DB_URL.trim() !== ''
    ? process.env.DB_URL
    : `mongodb://${DB_HOST}:27017/${DB_DATABASE}?replicaSet=rs0`;
export const { NODE_ENV, PORT, APP_SECRET_KEY, ADMIN_SECRET_KEY, AGENT_SECRET_KEY, LOG_FORMAT, LOG_DIR, ORIGIN_LOCAL, ORIGIN_CRICKET, ORIGIN_LIVE, ORIGIN_SATTA, ORIGIN_LOCAL_1, ORIGIN_LOCAL_2, ORIGIN_SATTA_1, ORIGIN_LIVE_1, ORIGIN_ANDROID_APP, ORIGIN_IOS_APP } = process.env;
export const ADMIN_TYPES = ['super_admin', 'admin', 'super_master', 'master', 'super_agent', 'agent']
export const GAME_MODES = ["single-digit", "double-digit", "single-panna", "double-panna", "triple-panna", "even-odd-digit", "full-sangum", "half-sangum",
    "sp-dp-tp", "cycle-panna", "sp-mortor", "dp-mortor", "double-even-odd", "left-digit", "jodi-digit", "right-digit", "jodi-bulk", "single-panna-bulk",
    "double-panna-bulk"]
export const SUB_MODES = ["sp", "dp", "tp"]
export const GAME_TYPES = ["main", "starline", "galidisawar"]
export const GAME_SESSION = ["close", "open", "-"]
export const BET_STATUS = ["running", "closed", "cancelled"]
export const OTP_key = process.env.OTP_KEY
export const GAME_OFF = process.env.GAME_OFF
export const TRANSACTION_TYPES = ["bet", "mobile", "referral", "admin", "agent", "bonus", "a_admin", "a_agent"]
export const TRANSACTION_TRANSFER_TYPES = ["win", "lose", "deposit", "withdrawal", "user_transfer", "upi"]
export const TRANSACTION_STATUS = ["pending", "completed", "cancelled", "success", "failure"]
export const PHONE_NUMBER = process.env.PHONE_NO
export const TERMINAL_WS_URL = process.env.TERMINAL_WS_URL || 'wss://socket.hpterminal.com/ws';
/** Redis URL for match cache (ioredis) and Socket.IO redis-adapter pub/sub (node-redis). */
export const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

//super_admin'->  'admin'-> 'super_master'->  'master'->  'super_agent' -> 'agent' -> 'user'
