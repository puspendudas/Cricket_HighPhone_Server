import { model, Schema } from 'mongoose';
import { SliderDocument } from '@/interfaces/slider.interface';

const sliderSchema = new Schema<SliderDocument>(
  {
    tag: { type: String, required: true },
    state: { type: Boolean, required: true, default: true },
    link: { type: String, required: true }
  },
  { timestamps: true },
);

const SliderModel = model<SliderDocument>('Slider', sliderSchema);

export default SliderModel;