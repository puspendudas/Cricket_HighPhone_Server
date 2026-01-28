import BetModel from '@/models/bet.model';
import ResultModel from '@/models/result.model';
import TransactionModel from '@/models/transaction.model';
import UserModel from '@/models/user.model';
import { NextFunction, Request, Response } from 'express';
import path from 'path';

class MiscController {
  public result = ResultModel;
  public bet = BetModel;
  public transaction = TransactionModel;
  public user = UserModel;
  // public settingService: SettingService;

  // constructor() {
  //   this.settingService = new SettingService();
  // }

  public getImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, type } = req.query;
      if (!name || !type) {
        return res.status(200).json({ status: 'failure', message: "need name and type" });
      }
      const filePath = path.join(__dirname, '..', '../public', String(type), String(name));
      res.status(200).sendFile(filePath);
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  public getAPK = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = path.join(__dirname, '..', '..', 'assets', 'app.apk')
      
      res.status(200).sendFile(file)
    } catch (error) {
      console.log(error);
      next(error);
    }
  };

  public deleteall = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      
      interface Query {
        createdAt?: {
          $gte?: string;
          $lt?: string;
        };
      }
  
      const query: Query = {};
      if (from !== undefined || to !== undefined) query.createdAt = {};
      if (from !== undefined) query.createdAt.$gte = String(from);
      if (to !== undefined) query.createdAt.$lt = String(to);
  
      // Delete transactions based on the query.
      await this.transaction.deleteMany(query);
      // Delete bets based on the query.
      await this.bet.deleteMany(query);
  
      res.status(200).json({ status: "success", message: "Data deleted successfully." });
    } catch (error) {
      console.error(error);
      next(error);
    }
  };
  


}

export default MiscController;