import mongoose, { model, Schema } from 'mongoose';
import { UserDocument } from '@interfaces/users.interface';

const userSchema = new Schema<UserDocument>(
  {
    user_name: {
      type: String, required: true, unique: true, select: true, index: true, validate: {
        // add validator to min 6 length
        validator: (v: string) => /^[a-zA-Z0-9_]{6,15}$/.test(v),
        message: (props: any) => `${props.value} is should be length 6`
      }
    },
    name: { type: String },
    mpin: { type: String },
    password: { type: String },
    email: { type: String },
    mobile: { type: String, required: false },
    // mobile: { type: String, required: true, unique: true, select: true, validate: {
    //     validator: (v: string) => /^\d{10}$/.test(v), // Regular expression for mobile number validation
    //     message: (props: any) => `${props.value} is not a valid mobile number!`
    // }},
    wallet: { type: Number, required: true, default: 0 },
    exposure: { type: Number, required: true, default: 0 },
    rate_diff: { type: Number, required: true, default: 2, select: true },
    stack: { type: [Number], required: true, default: [100, 500, 1000, 2000, 5000, 10000, 20000, 50000], select: true },
    match_commission: { type: Number, default: 0, select: true },
    session_commission: { type: Number, default: 0, select: true },
    casino_commission: { type: Number, default: 0, select: true },
    // admin_id: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", select: false, default: null },
    verified: { type: Boolean, required: true, default: false },
    otp_verified: { type: Boolean, required: true, default: false },
    authentication: { type: Boolean },
    status: { type: Boolean, default: false, select: true },
    bm_lock: { type: [mongoose.Schema.Types.ObjectId], ref: "Match", select: true },
    fancy_lock: { type: [mongoose.Schema.Types.ObjectId], ref: "Match", select: true },
    branch_name: { type: String, default: '-', select: false },
    bank_name: { type: String, default: '-', select: false },
    account_holder_name: { type: String, default: "-", select: false },
    account_no: { type: String, default: "-", select: false },
    ifsc_code: { type: String, default: "-", select: false },
    otp: { type: String, select: false, default: '-' },
    otp_expiry: { type: Date, select: false, default: Date.now() + 1000 * 60 * 5 },
    referral_code: { type: String },
    upi_id: { type: String, default: '-' },
    upi_number: { type: String, default: '-' },
    betting: { type: Boolean, default: false },
    transfer: { type: Boolean, default: false },
    fcm: { type: String, default: '-' },
    personal_notification: { type: Boolean, default: true },
    main_notification: { type: Boolean, default: true },
    starline_notification: { type: Boolean, default: true },
    galidisawar_notification: { type: Boolean, default: true },
    referral_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", select: false },
    agent_id: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", select: false },
    // bets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bet", select: false }],
    // enquiry: [{ type: mongoose.Schema.Types.ObjectId, ref: "enquiry", select: false }],
    // transaction: [{ type: mongoose.Schema.Types.ObjectId, ref: "Transaction", select: false }],
    referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", select: false }],
    notification: [{ type: mongoose.Schema.Types.ObjectId, ref: "notification", select: false }]
  },
  { timestamps: true },
);

const UserModel = model<UserDocument>('User', userSchema);

export default UserModel;
