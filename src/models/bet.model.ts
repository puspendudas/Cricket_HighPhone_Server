import mongoose, { model, Schema } from 'mongoose';
import { BET_STATUS, GAME_MODES, GAME_SESSION, GAME_TYPES, SUB_MODES } from '@/config';
import { BetDocument } from '@/interfaces/bet.interface';

const betSchema = new Schema<BetDocument>(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    game_mode: { type: String, required: true, enum: GAME_MODES },
    sub_mode: { type: String, enum: SUB_MODES },
    market_id: { type: mongoose.Schema.Types.ObjectId, ref: "Market" },
    market_name: { type: String },
    user_bal: { type: Number, required: true, default: 0 },
    commission: { type: Number, default: 0 },
    agent_id: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    session: { type: String, enum: GAME_SESSION },
    open_digit: { type: String, default: '-' },
    close_digit: { type: String, default: '-' },
    open_panna: { type: String, default: '-' },
    close_panna: { type: String, default: '-' },
    win: { type: String, default: '-' },
    points: { type: Number },
    result: [],
    bet_amount: { type: Number },
    winning_amount: { type: Number },
    tag: { type: String, enum: GAME_TYPES },
    status: { type: String, required: true, enum: BET_STATUS, default: "running" },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'transaction' },
  },
  { timestamps: true },
);

const BetModel = model<BetDocument>('Bet', betSchema);

export default BetModel;
