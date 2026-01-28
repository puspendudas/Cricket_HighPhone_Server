// walletHistory.interface.ts
import { Document } from 'mongoose';

interface WalletHistory {
  id?: any;
  user_id: any;
  receiver_id: any;
  amount: number;
  type: string;
  status: string;
  note: string;
  user_type: string;
  agent_id: any;
}

// Extend the User interface with Document to include Mongoose-specific functionality
interface WalletHistoryDocument extends WalletHistory, Document {
  id: string;
}

interface WalletHistoryRespond {
  user_id: any;
  receiver_id: any;
  amount: number;
  type: string;
  status: string;
  note: string;
  user_type: string;
  agent_id: any;
}

interface CreateWalletHistory {
  user_id: any;
  receiver_id: any;
  amount: number;
  type: string;
  status: string;
  note: string;
  user_type: string;
  agent_id: any;
}

export { WalletHistory, WalletHistoryDocument, WalletHistoryRespond, CreateWalletHistory };
