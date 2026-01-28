import mongoose, { model, Schema } from 'mongoose';
import { MatchTransactionDocument, MatchTransactionStatus, MatchTransactionTransferType, MatchTransactionType } from "@/interfaces/matchTransaction.interface";


const matchTransactionSchema = new Schema<MatchTransactionDocument>(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number, required: true },
    type: { type: String, required: true, enum: MatchTransactionType, default: MatchTransactionType.NONE },
    transfer_type: { type: String, enum: MatchTransactionTransferType, default: MatchTransactionTransferType.NORMAL },
    agent_id: { type: mongoose.Schema.Types.ObjectId, required: false, ref: 'Admin'  },
    note: { type: String, required: false, default: '' },
    withdraw_type: { type: String, required: false, default: '' },
    approved_by: { type: mongoose.Schema.Types.ObjectId, required: false, ref: 'Admin' },
    status: { type: String, required: true, enum: MatchTransactionStatus, default: MatchTransactionStatus.PENDING },
    receipt: { type: String, required: false, default: '' },
    bet_id: { type: mongoose.Schema.Types.ObjectId, required: false, ref: 'MatchBet' },
    match_id: { type: mongoose.Schema.Types.ObjectId, required: false, ref: 'Match' },
  },
  { timestamps: true },
);

const MatchTransactionModel = model<MatchTransactionDocument>('MatchTransaction', matchTransactionSchema);

export default MatchTransactionModel;
