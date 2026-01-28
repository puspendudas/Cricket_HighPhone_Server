// announcement.model.ts
import mongoose, { model, Schema } from 'mongoose';
import { AnnouncementDocument } from '@interfaces/announcement.interface';

const AnnouncementSchema = new Schema<AnnouncementDocument>(
    {
      title: { type: String, required: true, default: '-', select: true },
      body: { type: String, required: true, default: '-', select: true },
      user_type: { type: String, required: true, default: 'all', enum: ['all', 'user', 'admin'], select: true },
      status: { type: Boolean, default: false, required: true, select: true },
      match_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: false, select: true },
    },
    { timestamps: true },
);

const AnnouncementModel = model<AnnouncementDocument>('Announcement', AnnouncementSchema);

export default AnnouncementModel;

