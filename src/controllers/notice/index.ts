import { NextFunction, Request, Response } from 'express';
import NoticeService from '@/services/notice.service';
import { CreateNoticeDto, GetNoticeDto, ToggleNoticeDto } from '@/dtos/notice.dto';
import { RequestWithUser } from '@/interfaces/auth.interface';

class NoticeController {
  public noticeService: NoticeService;

  constructor() {
    this.noticeService = new NoticeService();
  }

  public createNotice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const noticeData: CreateNoticeDto = req.body;
      const result = await this.noticeService.createNotice(noticeData);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  public getAllNotices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const getNoticeData: GetNoticeDto = req.query;
      const result = await this.noticeService.getAllNotices(getNoticeData);
      res.status(200).json({ status: "success", ...result });
    } catch (err) {
      next(err);
    }
  }

  public getAllNoticesApp = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id as unknown as string;
      const getNoticeData: GetNoticeDto = req.query;
      const result = await this.noticeService.getAllNoticesApp(userId, getNoticeData);
      res.status(200).json({ status: "success", ...result });
    } catch (err) {
      next(err);
    }
  }

  public toggleNotice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const noticeToggleData: ToggleNoticeDto = req.body;
      await this.noticeService.toggleNotice(noticeToggleData);
      res.status(200).json({ status: 'success', message: "toggle operation success" });

    } catch (err) {
      next(err);
    }
  };

  public deleteNotice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { notice_id: NoticeData } = req.params;
      const result = await this.noticeService.deleteNotice(NoticeData);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

}

export default NoticeController;
