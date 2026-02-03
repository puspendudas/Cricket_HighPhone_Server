import { Document } from 'mongoose';

interface Transaction {
  id?: any;
  user_id: any;
  receiver_id: any;
  amount: number;
  type: string;
  transfer_type: string;
  agent_id: any;
  approved_by: any;
  note: string;
  withdraw_type: string;
  status: string;
  market_id: any;
  tax_id: string;
  ref_id: string;
  payment_proof: string;
  receipt: string;
  prev_balance: number;
  current_balance: number;
  bet_id: any;
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface TransactionDocument extends Transaction, Document {
  id: string;
}

interface TransactionRespond {
  user_id: any;
  receiver_id: any;
  amount: number;
  type: string;
  transfer_type: string;
  agent_id: any;
  approved_by: any;
  note: string;
  withdraw_type: string;
  status: string;
  market_id: any;
  tax_id: string;
  ref_id: string;
  payment_proof: string;
  receipt: string;
  prev_balance: number;
  current_balance: number;
  bet_id: any;
}

interface CreateTransaction {
  user_id: any;
  receiver_id: any;
  amount: number;
  type: string;
  transfer_type?: string;
  agent_id?: any;
  approved_by?: any;
  note?: string;
  withdraw_type?: string;
  status?: string;
  market_id?: any;
  tax_id?: string;
  ref_id?: string;
  payment_proof: string;
  receipt: string;
  prev_balance?: number;
  current_balance?: number;
  bet_id?: any;
}

export { Transaction, TransactionDocument, TransactionRespond, CreateTransaction };
