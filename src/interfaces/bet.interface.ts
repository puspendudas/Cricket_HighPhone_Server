import { Document } from 'mongoose';

interface Bet {
    id?: any;
    user_id: any;
    game_mode: string;
    sub_mode: string;
    market_id: any;
    market_name: string;
    user_bal: number;
    commission: number;
    agent_id: any;
    session: string;
    open_digit: string;
    close_digit: string;
    open_panna: string;
    close_panna: string;
    win: string;
    points: number;
    result: any;
    bet_amount: number;
    winning_amount: number;
    tag: string;
    status: string;
    transaction: any;
    updatedAt?: any
    createdAt?: any
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface BetDocument extends Bet, Document {
  id: string;
}

interface BetRespond {
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
    commission: number;
    agent_id: any;
    market_status: boolean
    market_off_day: any,
    games: any
}

interface CreateBet{
  user_id: string;
  session: string;
  open_digit?: string;
  close_digit?: string;
  open_panna?: string;
  close_panna?: string;
  points: number;
  commission: number;
  agent_id: any;
  game_mode: string;
  market_id: string;
  tag: string;
}

interface PointsBet{
  count: number;
  total_points: number;
  _id: string;
}

interface GetAllBet {
  user_info?: any;
  user_id?: string;
  agent_id?: string;
  status?: string;
  query_date?: string;
  createdAt?: {
      $gte?: string;
      $lt?: string;
  };
  market_id?: string;
  market_name?: string;
  session?: string;
  win?: string;
  commission?: string;
  game_mode?: string;
  tag?: string;
  count?: string;
  skip?: string;
}

interface GetUserBet {
  user_id?: string;
  from?: string;
  to?: string;
  createdAt?: {
      $gte?: string;
      $lt?: string;
  };
  market_id?: string;
  game_mode?: string;
  win?: string;
  tag?: string;
}

export { Bet, BetDocument, BetRespond, CreateBet, PointsBet, GetAllBet, GetUserBet };
