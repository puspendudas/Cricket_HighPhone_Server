import { Document } from 'mongoose';

interface Result {
    id?: any;
    market_id: any,
    market_name: string,
    open_result: string,
    close_result: string,
    open_declare: Date
    close_declare: Date
    tag: string
    from: Date
    to: Date
    createdAt: Date
    updatedAt: Date
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface ResultDocument extends Result, Document {
  id: string;
}

interface ResultRespond {
    market_id: any,
    market_name: string,
    open_result: string,
    close_result: string,
    open_declare: Date
    close_declare: Date
    tag: string
    from: Date
    to: Date
}

export { Result, ResultDocument, ResultRespond };
