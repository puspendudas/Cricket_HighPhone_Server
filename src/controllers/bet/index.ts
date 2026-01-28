import { NextFunction, Request, Response } from 'express';
import BetService from '@/services/bet.service';
import { CreateBetDto, GetAllBetDto, GetUserBetDto, PonitsBetAllDto, PointsBetDto, UpdateBetDto, ProfitBetDto } from '@/dtos/bet.dto';
import { GetAllBet } from '@/interfaces/bet.interface';

class BetController {
  public betService: BetService;

  constructor() {
    this.betService = new BetService();
  }

  public create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const betData: CreateBetDto[] = Array.isArray(req.body) ? req.body : [req.body];
      const createBetData = await this.betService.create(betData);

      res.status(201).json({ status: "success", message: 'New Bet create', createBetData });
    } catch (error) {
      next(error);
    }
  };

  public updateBetArray = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const betData: UpdateBetDto = req.body;

      await this.betService.updateBetArray(betData);
      res.status(200).json({ status: 'success', message: "Bet updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  public getPointsAmount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pointsData: PointsBetDto = req.body
      const results = await this.betService.getPointsAmount(pointsData);
      res.status(200).json({ status: "success", data: results });
    } catch (error) {
      next(error);
    }
  };

  public getBet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const getBetData: GetAllBetDto = req.query;

      let query: GetAllBet = {
        ...getBetData
      };

      if (getBetData.query_date) {
        const fromDate = new Date(getBetData.query_date);
        fromDate.setDate(fromDate.getDate() - 1);
        const from = fromDate.toISOString().split('T')[0] + "T18:30:00.000Z";
        const to = getBetData.query_date + "T18:29:59.999Z";
      
        query = {
          ...query,
          createdAt: {
            $gte: from,
            $lt: to
          }
        };
      } 
      delete query.query_date
      const { total, bet_list } = await this.betService.getBet(query);
      res.status(200).json({ status: 'success', total: total, data: bet_list });
    } catch (error) {
      next(error);
    }
  };

  public getUserBet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const getBetData: GetUserBetDto = req.query;
      const betData = await this.betService.getUserBet(getBetData);
      res.status(200).json({ status: 'success', data: betData });
    } catch (error) {
      next(error);
    }
  };

  public getAllPointsAmount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const BetData: PonitsBetAllDto = req.body;
      const data = await this.betService.getAllPointsAmount(BetData);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  public getProfitLossAmount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query_date: ProfitBetDto = req.query;
      const data = await this.betService.getProfitLossAmount(query_date);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };


}

export default BetController;