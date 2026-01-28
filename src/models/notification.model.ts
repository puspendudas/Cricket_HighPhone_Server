import mongoose, { model, Schema } from 'mongoose';
import { NotificationDocument } from '@/interfaces/notification.interface';

const NotificationSchema = new Schema<NotificationDocument>(
    {
        all_user: { type: Boolean, default: false },
        user_id: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
        title: { type: String },
        body: { type: String },
        status: { type: Boolean, default: true },
        link: { type: String, default: "-" },
        url: { type: String, default: "-" },

    },
    { timestamps: true },
);

const NotificationModel = model<NotificationDocument>('notification', NotificationSchema);

export default NotificationModel;