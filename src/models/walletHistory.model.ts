// walletHistory.model.ts
import mongoose, { model, Schema } from 'mongoose';
import { WalletHistoryDocument } from '@interfaces/walletHistory.interface';

const walletHistorySchema = new Schema<WalletHistoryDocument>(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    receiver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    note: { type: String, required: false, default: "" },
    user_type: { type: String, required: true, enum: ["User", "Admin"], default: "User" },
    amount: { type: Number, required: true },
    type: { type: String, required: true, enum: ["Debit", "Credit", "None"], default: "None" },
    status: { type: String, required: true, enum: ["success", "failed", "pending"], default: "pending" },
  },
  { timestamps: true },
);

const WalletHistoryModel = model<WalletHistoryDocument>('WalletHistory', walletHistorySchema);

export default WalletHistoryModel;
