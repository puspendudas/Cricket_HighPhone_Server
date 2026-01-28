// settlement.controller.ts

import { NextFunction, Request, Response } from 'express';
import { CreateSettlementDto } from '@/dtos/settlement.dto';
import SettlementService from '@/services/settlement.service';

class SettlementController {
  public settlementService: SettlementService;

  constructor() {
    this.settlementService = new SettlementService();
  }

  public createNewSettlement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settlementData: CreateSettlementDto = req.body;
      await this.settlementService.createNewSettlement(settlementData);
      res.status(201).json({ status: 'success', message: 'operation successful' });
    } catch (err) {
      if (err.message === 'need a tag') {
        return res.status(400).json({ status: 'failure', message: err.message });
      } else if (err.message === 'only 1 file upload is permitted') {
        return res.status(400).json({ status: 'failure', message: err.message });
      }
      next(err);
    }
  }

  public getSettlementById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id: string = req.params.id;
      const data = await this.settlementService.getSettlementById(id);  
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public getSettlementUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id: string = req.params.id;
      const data = await this.settlementService.getSettlementUserById(id);  
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public getSettlementToById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id: string = req.params.id;
      const data = await this.settlementService.getSettlementToById(id);  
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public getSettlementTotalById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id: string = req.params.id;
      const data = await this.settlementService.getSettlementTotalById(id);  
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

}

export default SettlementController;