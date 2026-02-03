import { model, Schema } from 'mongoose';
import { EnquiryDocument } from '@/interfaces/enquiry.interface';

const EnquirySchema = new Schema<EnquiryDocument>(
    {
        name: { type: String },
        mobile: { type: String },
        message: { type: String },
    },
    { timestamps: true },
);

const EnquiryModel = model<EnquiryDocument>('enquiry', EnquirySchema);

export default EnquiryModel;

