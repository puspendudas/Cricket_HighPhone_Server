import { Document } from 'mongoose';

interface Slider {
    id?: any;
    tag: String;
    state: Boolean;
    link: String;
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface SliderDocument extends Slider, Document {
    id: string;
}

interface SliderRespond {
    tag: String;
    state: Boolean;
    link: String;
}

export { Slider, SliderDocument, SliderRespond };
