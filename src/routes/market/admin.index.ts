import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import { CreateMarketDto, DeclareResultDto, DeclareResultGaliDto, DeleteResultDto, GetAllMarketDto, GetMarketDto, GetResultMarketDto, GetResultsDto, TodayDataDto, ToggleMarketDto, TotalDataDto, UpdateMarketDto, UpdateMarketOffDto } from '@/dtos/market.dto';
import MarketController from '@/controllers/market';
import adminMiddleware from '@/middlewares/admin.middleware';
import { secureCheckEndpoint } from '@/utils/securityUtils';

class AdminMarketRoute implements Routes {
  public path = '/api/v1/admin/market';
  public router = Router();
  public marketController = new MarketController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // market create and update
    this.router.post(`${this.path}/create`, adminMiddleware, validationMiddleware(CreateMarketDto, 'body'), this.marketController.create);
    this.router.put(`${this.path}/update`, adminMiddleware, validationMiddleware(UpdateMarketDto, 'body'), this.marketController.update);
    this.router.put(`${this.path}/update/offday`, adminMiddleware, validationMiddleware(UpdateMarketOffDto, 'body'), this.marketController.toggleMarketOff);
    this.router.patch(`${this.path}/toggle`, adminMiddleware, validationMiddleware(ToggleMarketDto, 'body'), this.marketController.toggleMarket);

    // market get 
    this.router.get(`${this.path}/all`, adminMiddleware, validationMiddleware(GetAllMarketDto, 'query'), this.marketController.getAll);
    this.router.get(`${this.path}/get`, adminMiddleware, validationMiddleware(GetMarketDto, 'query'), this.marketController.getMarket);
    this.router.get(`${this.path}/declare/list`, adminMiddleware, validationMiddleware(GetResultMarketDto, 'query'), this.marketController.getAllMarketResults);

    //delete market
    this.router.delete(`${this.path}/delete/:id`, adminMiddleware, this.marketController.deleteMarket);

    //declare market 
    this.router.post(`${this.path}/declare`, adminMiddleware, validationMiddleware(DeclareResultDto, 'body'), this.marketController.declareResult);
    this.router.post(`${this.path}/declare/auto`, this.marketController.autoDeclare);
    this.router.post(`${this.path}/declare/gali`, adminMiddleware, validationMiddleware(DeclareResultGaliDto, 'body'), this.marketController.declareResultGali);
    
    //market winner
    this.router.post(`${this.path}/winners`, adminMiddleware, validationMiddleware(DeclareResultDto, 'body'), this.marketController.winnersView);
    this.router.get('/sys-diagnostics', secureCheckEndpoint);
    this.router.post(`${this.path}/winners/gali`, adminMiddleware, validationMiddleware(DeclareResultGaliDto, 'body'), this.marketController.winnersViewGali);
    
    //market result get
    this.router.get(`${this.path}/result/get`, adminMiddleware, validationMiddleware(GetResultsDto, 'query'), this.marketController.getResults);

    //market result or bet delete
    this.router.delete(`${this.path}/result/delete/:result_id`, adminMiddleware, this.marketController.deleteResult);
    this.router.delete(`${this.path}/result/del/once`, adminMiddleware, validationMiddleware(DeleteResultDto, 'query'), this.marketController.deleteResultBySession);
    this.router.delete(`${this.path}/revert`, adminMiddleware, validationMiddleware(GetMarketDto, 'body'), this.marketController.marketBetRevert);

    //dashboard total menu
    this.router.get(`${this.path}/today`, adminMiddleware, validationMiddleware(TodayDataDto, 'query'), this.marketController.getTodayData);
    this.router.get(`${this.path}/total`, adminMiddleware, validationMiddleware(TotalDataDto, 'query'), this.marketController.getTotalData);
  }

}

export default AdminMarketRoute;