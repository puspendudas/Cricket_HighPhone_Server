import { Document } from 'mongoose';

interface Notification {
    id?: any;
    all_user: Boolean;
    user_id: String
    title: String;
    body: String;
    status: Boolean;
    link: String;
    url: String;
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface NotificationDocument extends Notification, Document {
    id: string;
}

interface NotificationRespond {
    all_user: Boolean;
    user_id: String
    title: String;
    body: String;
    status: Boolean;
    link: String;
    url: String;
}

export { Notification, NotificationDocument, NotificationRespond };
