import { NextFunction, Request, Response } from 'express';
import SliderService from '@/services/slider.service';
import { SliderDto } from '@/dtos/slider.dto';
import { RequestWithUser } from '@/interfaces/auth.interface';

class SliderController {
  public sliderService: SliderService;

  constructor() {
    this.sliderService = new SliderService();
  }

  public createNewSlider = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sliderData: SliderDto = req.body;
      await this.sliderService.createNewSlider(sliderData);
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

  public getSliders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.sliderService.getSliders();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public getSlidersApp = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id as string;
      const data = await this.sliderService.getSlidersApp(userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public deleteSlider = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slider_id: sliderData } = req.params;
      const result = await this.sliderService.deleteSlider(sliderData);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public toggleSlider = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slider_id: sliderData } = req.params;
      const result = await this.sliderService.toggleSlider(sliderData);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

}

export default SliderController;