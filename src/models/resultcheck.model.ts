import mongoose, { model, Schema } from 'mongoose';
import { ResultDocument } from '@/interfaces/result.interface';
import { GAME_TYPES } from '@/config';

const resultSchema = new Schema<ResultDocument>(
  {
    market_id: { type: mongoose.Schema.Types.ObjectId, ref: "Market" },
    market_name: { type: String },
    open_result: { type: String },
    close_result: { type: String },
    tag: { type: String, enum: GAME_TYPES },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
  },
  { timestamps: true },
);

const ResultCheckModel = model<ResultDocument>('ResultCheck', resultSchema);

export default ResultCheckModel;
