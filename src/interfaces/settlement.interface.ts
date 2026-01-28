// settlement.interface.ts
import { Document } from 'mongoose';

interface Settlement {
    id?: any;
    adminIdTo: any;
    adminIdFrom: any;
    ammount: number;
    type: string;
    remark: string;
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface SettlementDocument extends Settlement, Document {
    id: string;
}

interface SettlementRespond {
    adminIdTo: number;
    adminIdFrom: number;
    ammount: number;
    type: string;
    remark: string;
}

export { Settlement, SettlementDocument, SettlementRespond };
