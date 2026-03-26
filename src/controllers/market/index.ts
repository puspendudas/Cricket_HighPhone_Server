import { NextFunction, Request, Response } from 'express';
import MarketService from '@/services/market.service';
import { CreateMarketDto, DeclareResultDto, DeclareResultGaliDto, DeleteResultDto, GetMarketDto, GetResultMarketDto, GetResultsDto, TodayDataDto, ToggleMarketDto, TotalDataDto, UpdateMarketDto, UpdateMarketOffDto } from '@/dtos/market.dto';
import { RequestWithUser } from '@/interfaces/auth.interface';

class MarketController {
  public marketService: MarketService;

  constructor() {
    this.marketService = new MarketService();
  }

  public create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const marketData: CreateMarketDto = req.body;
      await this.marketService.create(marketData);

      res.status(201).json({ status: "success", message: 'New market create' });
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const marketData: UpdateMarketDto = req.body;
      await this.marketService.update(marketData);

      res.status(201).json({ status: "success", message: 'market update successfuly' });
    } catch (error) {
      next(error);
    }
  };

  public toggleMarketOff = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const marketOffData: UpdateMarketOffDto = req.body;
      const market = await this.marketService.toggleMarketOff(marketOffData);
      res.status(200).json({ status: 'success', message: "toggle operation success", data: market.market_off_day });

    } catch (err) {
      next(err);
    }
  };

  public getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const marketData: any = req.query;
      const { markets, total } = await this.marketService.getAll({
        ...marketData,
        ...(marketData.name && { name: { $regex: marketData.name, $options: 'i' } }),
      });

      res.status(200).json({ status: "success", message: 'All market data', total: total, data: markets });
    } catch (error) {
      next(error);
    }
  };

  public getAllApp = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const marketData: any = req.query;
      const userId = String(req.user._id);
      const { markets, total } = await this.marketService.getAllApp(userId, {
        ...marketData,
        ...(marketData.name && { name: { $regex: marketData.name, $options: 'i' } }),
      });

      res.status(200).json({ status: "success", message: 'All market data', total: total, data: markets });
    } catch (error) {
      next(error);
    }
  };

  public getAllMarketResults = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const marketData: GetResultMarketDto = req.query
      const data = await this.marketService.getAllMarketResults(marketData);
      res.status(200).json({ status: 'success', total: data.total, data: data.data });
    } catch (error) {
      next(error);
    }
  };

  public getMarket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const marketData: GetMarketDto = req.query;
      const { data } = await this.marketService.getMarket(marketData);

      res.status(200).json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };

  public toggleMarket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const marketToggleData: ToggleMarketDto = req.body;
      await this.marketService.toggleMarket(marketToggleData);
      res.status(200).json({ status: 'success', message: "toggle operation success" });

    } catch (err) {
      next(err);
    }
  };

  public marketGames = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const marketGameData: any = req.query;
      const gameData = await this.marketService.marketGames(marketGameData);
      res.status(200).json({ status: 'success', data: gameData });
    } catch (err) {
      next(err);
    }
  };

  public declareResult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultData: DeclareResultDto = req.body;
      await this.marketService.declareResult(resultData);
      res.status(200).json({ status: "success", message: `Successfully declared result for ${resultData.session} session` });
    } catch (error) {
      next(error);
    }
  };

  public declareResultGali = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultData: DeclareResultGaliDto = req.body;
      await this.marketService.declareResultGali(resultData);
      res.status(200).json({ status: "success", message: `Successfully declared result` });
    } catch (error) {
      next(error);
    }
  };

  public winnersView = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultData: DeclareResultDto = req.body;

      const showData: any = await this.marketService.winnersView(resultData);
      res.status(200).json({
        status: "success", message: `Successfully show result for ${resultData.session} session`,
        total_bet_amount: showData.total_bet_amount, total_winning_amount: showData.total_winning_amount, data: showData.data
      });
    } catch (error) {
      next(error);
    }
  };

  public winnersViewGali = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultData: DeclareResultGaliDto = req.body;
      const showData: any = await this.marketService.winnersViewGali(resultData);
      res.status(200).json({
        status: "success", message: `Successfully show result`,
        total_bet_amount: showData.total_bet_amount, total_winning_amount: showData.total_winning_amount, data: showData.data
      });
    } catch (error) {
      next(error);
    }
  };

  public getResults = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queryParams: GetResultsDto = req.query as any;

      const { total, data } = await this.marketService.getResults(queryParams);

      res.status(200).json({ status: 'success', total, data });
    } catch (error) {
      next(error);
    }
  };

  public getResultsApp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queryParams: GetResultsDto = req.query as any;

      const { total, data } = await this.marketService.getResultsApp(queryParams);

      res.status(200).json({ status: 'success', total, data });
    } catch (error) {
      next(error);
    }
  };

  public getResultsWeb = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queryParams: GetResultsDto = req.query as any;

      const { total, data } = await this.marketService.getResultsWeb(queryParams);

      res.status(200).json({ status: 'success', total, data });
    } catch (error) {
      next(error);
    }
  };

  public deleteResult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { result_id: resultData } = req.params;
      const result = await this.marketService.deleteResultById(resultData);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public deleteResultBySession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultData: DeleteResultDto = req.query;
      const result = await this.marketService.deleteResultByIdAndSession(resultData);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public deleteMarket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const marketId = req.params.id;
      await this.marketService.deleteMarket(marketId);
      res.status(200).json({ status: "success", message: "Delete market successfully" });
    } catch (err) {
      next(err);
    }
  };

  public getTotalData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const getBetData: TotalDataDto = req.query;
      const {
        totalDepositAmount,
        totalWithdrawlAmount,
        allUsers,
        approvedUsers,
        unapprovedUsers,
        totalBetAmount,
        totalBetWinAmount,
        allMarkets,
        mainMarkets,
        starlineMarkets,
        galidisawarMarkets,
        totalAgent
      } = await this.marketService.getTotalData(getBetData);

      res.status(200).json({
        status: "success",
        totalDepositAmount,
        totalWithdrawlAmount,
        allUsers,
        approvedUsers,
        unapprovedUsers,
        totalBetAmount,
        totalBetWinAmount,
        allMarkets,
        mainMarkets,
        starlineMarkets,
        galidisawarMarkets,
        totalAgent
      });
    } catch (err) {
      next(err);
    }
  };

  public getTodayData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const getBetData: TodayDataDto = req.query;
      const {
        totalDepositAmount,
        totalWithdrawlAmount,
        allUsers,
        approvedUsers,
        unapprovedUsers,
        totalBetAmount,
        totalBetWinAmount,
        allMarkets,
        mainMarkets,
        starlineMarkets,
        galidisawarMarkets,
        totalAgent
      } = await this.marketService.getTodayData(getBetData);

      res.status(200).json({
        status: "success",
        totalDepositAmount,
        totalWithdrawlAmount,
        allUsers,
        approvedUsers,
        unapprovedUsers,
        totalBetAmount,
        totalBetWinAmount,
        allMarkets,
        mainMarkets,
        starlineMarkets,
        galidisawarMarkets,
        totalAgent
      });
    } catch (err) {
      next(err);
    }
  };

  public marketBetRevert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const marketData: GetMarketDto = req.body;
      const result = await this.marketService.marketBetRevert(marketData);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public autoDeclare = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // const getBetData: TotalDataDto = req.query;
      // const resultData: DeclareResultDto = req.body;
      await this.marketService.autoDeclare();
      res.status(200).json({ status: "success", message: `Successfully declared result for session` });
    } catch (err) {
      next(err);
    }
  };

}

export default MarketController;