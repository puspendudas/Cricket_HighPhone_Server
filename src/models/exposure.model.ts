// Exposure model
import { model, Schema } from 'mongoose';
import { ExposureDocument, ExposureStatus } from '@interfaces/exposure.interface';

const ExposureSchema = new Schema<ExposureDocument>(
    {
        user_id: { type: Schema.Types.ObjectId, ref: 'User' },
        match_id: { type: Schema.Types.ObjectId, ref: 'Match' },
        gameId: { type: String, required: true },
        bet_type: { type: String, required: true },
        selection_id: { type: Number, required: false },
        potential_profitloss: { type: Schema.Types.Mixed, required: false },
        exposure: { type: Number, required: false },
        transaction_id: [{ type: Schema.Types.ObjectId, ref: 'MatchTransaction', required: false }],
        settlement_status: { type: String, required: false, enum: ExposureStatus, default: ExposureStatus.PENDING },
        settlement_amount: { type: Number, required: false, default: null },
        settlement_commission: { type: Number, required: false, default: null },
        settled_at: { type: Date, required: false },
        status: { type: Boolean, required: true, default: true},
    },
    { timestamps: true },
);

const ExposureModel = model<ExposureDocument>('exposure', ExposureSchema);

export default ExposureModel;

