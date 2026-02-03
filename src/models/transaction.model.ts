import mongoose, { model, Schema } from 'mongoose';
import { TRANSACTION_STATUS, TRANSACTION_TRANSFER_TYPES, TRANSACTION_TYPES } from '@/config';
import { TransactionDocument } from '@/interfaces/transaction.interface';

const transactionSchema = new Schema<TransactionDocument>(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number, required: true },
    type: { type: String, required: true, enum: TRANSACTION_TYPES },
    transfer_type: { type: String, enum: TRANSACTION_TRANSFER_TYPES  },
    agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin'  },
    note: { type: String },
    withdraw_type: { type: String },
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    status: { type: String, required: true, enum: TRANSACTION_STATUS, default: "pending" },
    market_id: { type: mongoose.Schema.Types.ObjectId, ref: "Market" },
    tax_id: { type: String, default: 'n/a' },
    ref_id: { type: String, default: 'n/a' },
    payment_proof: { type: String },
    receipt: { type: String },
    prev_balance: { type: Number, default: 0 },
    current_balance: { type: Number, default: 0 },
    bet_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Bet' }
  },
  { timestamps: true },
);

const TransactionModel = model<TransactionDocument>('Transaction', transactionSchema);

export default TransactionModel;
