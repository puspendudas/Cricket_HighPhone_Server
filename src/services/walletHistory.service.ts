import WalletHistoryModel from '@/models/walletHistory.model';
import { GetWalletHistoryDto } from '@/dtos/walletHistory.dto';
import { ObjectId } from 'mongodb';

class WalletHistoryService {
  public walletHistoryModel = WalletHistoryModel;

  public async getAllWalletHistorys(getWalletHistoryData: GetWalletHistoryDto): Promise<{ total: number, data: any[] }> {
    const { id, user_type, status, type, skip, count } = getWalletHistoryData
    const query: { [key: string]: string | ObjectId } = {};
    if (user_type !== undefined) query.user_type = String(user_type);
    if (id !== undefined && user_type == "Admin") query.agent_id = new ObjectId(id);
    if (id !== undefined && user_type == "User") query.receiver_id = new ObjectId(id);
    if (status !== undefined) query.status = String(status);
    if (type !== undefined) query.type = String(type);
    
    const total = await this.walletHistoryModel.countDocuments(query);
    const limit = count !== undefined ? Number(count) : total
    const walletHistory_list = await this.walletHistoryModel.find(query).skip(Number(skip) * limit).limit(limit);
    
    return { total, data: walletHistory_list };
  }

}

export default WalletHistoryService;
