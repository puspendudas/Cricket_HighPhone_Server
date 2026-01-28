import { model, Schema } from 'mongoose';
import { MarketDocument } from '@/interfaces/market.interface';
import { GAME_TYPES } from '@/config';

const marketSchema = new Schema<MarketDocument>(
  {
    name: { type: String, required: true },
    name_hindi: { type: String, required: true },
    open_time: { type: String },
    close_time: { type: String, required: true },
    status: { type: Boolean, required: true, default: false },
    open_digit: { type: String, default: '-' },
    close_digit: { type: String, default: '-' },
    open_panna: { type: String, default: '-' },
    close_panna: { type: String, default: '-' },
    tag: { type: String, required: true, default: 'main', enum: GAME_TYPES },
    market_status: { type: Boolean, default: true },
    market_off_day: {
      "monday": { type: Boolean, default: true },
      "tuesday": { type: Boolean, default: true },
      "wednesday": { type: Boolean, default: true },
      "thursday": { type: Boolean, default: true },
      "friday": { type: Boolean, default: true },
      "saturday": { type: Boolean, default: true },
      "sunday": { type: Boolean, default: true } 
    },
  },
  { timestamps: true },
);

marketSchema.pre('validate', function (next) {
  if (this.tag === 'galidisawar' && this.open_time) {
    this.invalidate('open_time', 'open_time is not required when tag is galidisawar!');
  }
  if (this.tag === 'starline' && this.close_time) {
    this.invalidate('close_time', 'close_time is not required when tag is starline!');
  }
  next();
});

const MarketModel = model<MarketDocument>('Market', marketSchema);

export default MarketModel;
