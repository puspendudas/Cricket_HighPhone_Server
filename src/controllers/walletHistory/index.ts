import { NextFunction, Request, Response } from 'express';
import WalletHistoryService from '@services/walletHistory.service';
import { GetWalletHistoryDto } from '@/dtos/walletHistory.dto';

class WalletHistoryController {
  public walletHistoryService: WalletHistoryService;

  constructor() {
    this.walletHistoryService = new WalletHistoryService();
  }

  public getAllWalletHistorys = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const getWalletHistoryData: GetWalletHistoryDto = req.query as unknown as GetWalletHistoryDto;
      const result = await this.walletHistoryService.getAllWalletHistorys(getWalletHistoryData);
      res.status(200).json({ status: "success", ...result });
    } catch (err) {
      next(err);
    }
  }


}

export default WalletHistoryController;
