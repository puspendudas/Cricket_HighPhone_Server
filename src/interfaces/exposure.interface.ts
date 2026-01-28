import { Document } from 'mongoose';


export enum ExposureStatus {
    PENDING = 'PENDING',
    CANCELLED = 'CANCELLED',
    SETTLED = 'SETTLED',
}

interface Exposure {
    id?: any;
    user_id: String;
    match_id: String;
    gameId: String;
    bet_type: String;
    selection_id: Number;
    exposure: Number;
    potential_profitloss: any;
    transaction_id?: any;
    settlement_status?: String;
    settlement_amount?: Number | null;
    settlement_commission?: Number | null;
    settled_at?: Date;
    status: Boolean;
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface ExposureDocument extends Exposure, Document {
    id: string;
}

interface ExposureRespond {
    user_id: String;
    match_id: String;
    gameId: String;
    bet_type: String;
    selection_id: Number;
    potential_profitloss: any;
    exposure: Number;
    settled_at?: Date;
    status: Boolean;
    settlement_status?: String;
    settlement_amount?: Number | null;
    settlement_commission?: Number | null;
}

export { Exposure, ExposureDocument, ExposureRespond };
