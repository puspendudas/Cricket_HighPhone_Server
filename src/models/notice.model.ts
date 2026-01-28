import { model, Schema } from 'mongoose';
import { NoticeDocument } from '@/interfaces/notice.interface';

const NoticeSchema = new Schema<NoticeDocument>(
    {
        title: { type: String },
        body: { type: String },
        button: { type: String },
        status: { type: Boolean, default: false },
        link: { type: String, default: "-"  },
        url: { type: String, default: "-" },
    },
    { timestamps: true },
);

const NoticeModel = model<NoticeDocument>('notice', NoticeSchema);

export default NoticeModel;

