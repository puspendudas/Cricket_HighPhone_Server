import { Document } from 'mongoose';

/**
 * Enum for Match Transaction types
 */
export enum MatchTransactionType {
  NONE = 'NONE',
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT'
}

/**
 * Enum for Match Transaction status
 */
export enum MatchTransactionStatus {
  DONE = 'DONE',
  PENDING = 'PENDING',
  CANCELLED = 'CANCELLED',
}

/**
 * Enum for Match Transaction Transfer types
 */
export enum MatchTransactionTransferType {
  NORMAL = 'NORMAL',
  CREATED = 'CREATED',
  BOOKMAKER_SETTLEMENT = 'BOOKMAKER_SETTLEMENT',
  BOOKMAKER_CANCELLED = 'BOOKMAKER_CANCELLED',
  FANCY_SETTLEMENT = 'FANCY_SETTLEMENT',
  FANCY_CANCELLED = 'FANCY_CANCELLED',
  BOOKMAKER_ROLLBACK = 'BOOKMAKER_ROLLBACK',
  FANCY_ROLLBACK = 'FANCY_ROLLBACK',
}


interface MatchTransaction {
  id?: any;
  user_id: any;
  receiver_id: any;
  amount: number;
  type: MatchTransactionType;
  transfer_type: MatchTransactionTransferType;
  agent_id: any;
  approved_by: any;
  note: string;
  withdraw_type: string;
  status: MatchTransactionStatus;
  market_id: any;
  tax_id: string;
  ref_id: string;
  payment_proof: string;
  receipt: string;
  prev_balance: number;
  current_balance: number;
  bet_id: any;
  match_id?: any;
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface MatchTransactionDocument extends MatchTransaction, Document {
  id: string;
}

interface MatchTransactionRespond {
  id?: any;
  user_id: any;
  receiver_id: any;
  amount: number;
  type: MatchTransactionType;
  transfer_type: MatchTransactionTransferType;
  agent_id: any;
  approved_by: any;
  note: string;
  withdraw_type: string;
  status: MatchTransactionStatus;
  market_id: any;
  tax_id: string;
  ref_id: string;
  payment_proof: string;
  receipt: string;
  prev_balance: number;
  current_balance: number;
  bet_id: any;
  match_id?: any;
}

interface CreateMatchTransaction {
  user_id: any;
  receiver_id: any;
  amount: number;
  type: MatchTransactionType;
  transfer_type?: MatchTransactionTransferType;
  agent_id?: any;
  approved_by?: any;
  note?: string;
  withdraw_type?: string;
  status?: MatchTransactionStatus;
  market_id?: any;
  tax_id?: string;
  ref_id?: string;
  payment_proof?: string;
  receipt?: string;
  prev_balance?: number;
  current_balance?: number;
  bet_id?: any;
  match_id?: any;
}

export { MatchTransaction, MatchTransactionDocument, MatchTransactionRespond, CreateMatchTransaction };
