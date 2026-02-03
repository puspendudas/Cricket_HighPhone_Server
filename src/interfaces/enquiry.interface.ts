import { Document } from 'mongoose';

interface Enquiry {
    id?: any;
    name: String;
    mobile: String;
    message: String;
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface EnquiryDocument extends Enquiry, Document {
    id: string;
}

interface EnquiryRespond {
    name: String;
    mobile: String;
    message: String;
}

export { Enquiry, EnquiryDocument, EnquiryRespond };