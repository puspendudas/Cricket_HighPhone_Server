import { Document } from 'mongoose';

interface Market {
    id?: any;
    name: string,
    name_hindi: string,
    open_time: string,
    close_time: string,
    status: boolean
    open_digit: string
    close_digit: string
    open_panna: string
    close_panna: string
    tag: string
    market_status: boolean
    market_off_day: any,
    games: any
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface MarketDocument extends Market, Document {
  id: string;
}

interface MarketRespond {
    name: string,
    name_hindi: string,
    open_time: string,
    close_time: string,
    status: boolean
    open_digit: string
    close_digit: string
    open_panna: string
    close_panna: string
    tag: string
    market_status: boolean
    market_off_day: any,
    games: any
}

interface GetAllMarketQuery {
  name?: { $regex: string, $options: 'i' };
  tag?: string;
  _id?: string;
  count?: number;
  skip?: number;
}

export { Market, MarketDocument, MarketRespond, GetAllMarketQuery };
