// settlement.model.ts
import { model, Schema } from 'mongoose';
import { SettlementDocument } from '@/interfaces/settlement.interface';

const settlementSchema = new Schema<SettlementDocument>(
  {
    adminIdTo: { type: Schema.Types.ObjectId, ref: 'Admin' },
    adminIdFrom: { type: Schema.Types.ObjectId, ref: 'Admin' },
    ammount: { type: Number, required: true },
    type: { type: String, required: true, enum: ['credit', 'debit'] },
    remark: { type: String, required: true },
  },
  { timestamps: true },
);

const SettlementModel = model<SettlementDocument>('Settlement', settlementSchema);

export default SettlementModel;
