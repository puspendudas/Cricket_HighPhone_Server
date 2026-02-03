import { Document } from 'mongoose';

interface Notice {
    id?: any;
    title: String;
    body: String;
    button: String;
    status: Boolean;
    link: String;
    url: String;
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface NoticeDocument extends Notice, Document {
    id: string;
}

interface NoticeRespond {
    title: String;
    body: String;
    button: String;
    status: Boolean;
    link: String;
    url: String;
}

export { Notice, NoticeDocument, NoticeRespond };