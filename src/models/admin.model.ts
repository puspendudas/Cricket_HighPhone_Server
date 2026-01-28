// admin.model.ts
import mongoose, { model, Schema } from 'mongoose';
import { AdminDocument } from '@/interfaces/admin.interface';
import { ADMIN_TYPES } from '@/config';

const adminSchema = new Schema<AdminDocument>(
  {
    user_name: {
      type: String, required: true, unique: true, select: true, index:true, validate: {
        // add validator to min 6 length
        validator: ( v: string ) =>  /^[a-zA-Z0-9_]{6,15}$/.test(v),
        message: (props: any) => `${props.value} is should be length 6`
      }
    },
    name: { type: String },
    app_access: { type: Boolean, default: false },
    web_access: { type: Boolean, default: false },
    email: { type: String },
    password: { type: String, required: true, select: true },
    mobile: { type: String, required: false },
    // mobile: {
    //   type: String, required: false, unique: false, select: false, validate: {
    //     validator: (v: string) => /^\d{10}$/.test(v), // Regular expression for mobile number validation
    //     message: (props: any) => `${props.value} is not a valid mobile number!`
    //   }
    // },
    agent_code: { type: String },
    status: { type: Boolean, default: true },
    transfer: { type: Boolean, default: false },
    tag_access: { type: Boolean, default: false },
    branch_name: { type: String, default: '-' },
    bank_name: { type: String, default: '-' },
    account_holder_name: { type: String, default: "-" },
    account_no: { type: String, default: "-" },
    ifsc_code: { type: String, default: "-" },
    upi_id: { type: String, default: '-' },
    upi_number: { type: String, default: '-' },
    tag_list: [],
    market_list: [],
    type: { type: String, required: true, enum: ADMIN_TYPES, default: 'agent' },
    parent_id: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", select: true, default: null },
    sub_admin_list: [{ type: mongoose.Schema.Types.ObjectId, ref: "Admin", select: false, default: null }],
    share: { type: Number, default: 0 },
    match_commission: { type: Number, default: 0 },
    session_commission: { type: Number, default: 0 },
    casino_commission: { type: Number, default: 0 },
    wallet: { type: Number, required: true, default: 0 },
    exposure: { type: Number, required: true, default: 0 },
    referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", select: false }],
    transaction: [{ type: mongoose.Schema.Types.ObjectId, ref: "Transaction", select: false }],
    bm_lock: { type: [mongoose.Schema.Types.ObjectId], ref: "Match", select: true, default: [] },
    bm_lock_status: { type: Boolean, default: true, select: true },
    fancy_lock: { type: [mongoose.Schema.Types.ObjectId], ref: "Match", select: true, default: [] },
    fancy_lock_status: { type: Boolean, default: true, select: true },
  },
  { timestamps: true },
);

const AdminModel = model<AdminDocument>('Admin', adminSchema);

export default AdminModel;
