import mongoose, { model, Schema } from 'mongoose';
import { ResultDocument } from '@/interfaces/result.interface';
import { GAME_TYPES } from '@/config';

const resultSchema = new Schema<ResultDocument>(
  {
    market_id: { type: mongoose.Schema.Types.ObjectId, ref: "Market" },
    market_name: { type: String },
    open_result: { type: String },
    close_result: { type: String },
    open_declare: { type: Date },
    close_declare: { type: Date },
    tag: { type: String, enum: GAME_TYPES },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
  },
  { timestamps: true },
);

const ResultModel = model<ResultDocument>('Result', resultSchema);

export default ResultModel;
