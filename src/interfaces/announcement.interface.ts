// announcement.interface.ts
import { Document } from 'mongoose';

interface Announcement {
    id?: any;
    title: String;
    body: String;
    user_type: String;
    status: Boolean;
    match_id: String;
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface AnnouncementDocument extends Announcement, Document {
    id: string;
}

interface AnnouncementRespond {
    title: String;
    body: String;
    user_type: String;
    status: Boolean;
    match_id: String;
}

export { Announcement, AnnouncementDocument, AnnouncementRespond };
