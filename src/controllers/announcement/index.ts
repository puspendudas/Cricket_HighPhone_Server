import { NextFunction, Request, Response } from 'express';
import AnnouncementService from '@services/announcement.service';
import { CreateAnnouncementDto, GetAnnouncementDto, ToggleAnnouncementDto } from '@/dtos/announcement.dto';

class AnnouncementController {
  public announcementService: AnnouncementService;

  constructor() {
    this.announcementService = new AnnouncementService();
  }

  public createAnnouncement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const AnnouncementData: CreateAnnouncementDto = req.body;
      const result = await this.announcementService.createAnnouncement(AnnouncementData);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  public getAllAnnouncements = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const getAnnouncementData: GetAnnouncementDto = req.query;
      const result = await this.announcementService.getAllAnnouncements(getAnnouncementData);
      res.status(200).json({ status: "success", ...result });
    } catch (err) {
      next(err);
    }
  }

  public toggleAnnouncement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const AnnouncementToggleData: ToggleAnnouncementDto = req.body;
      await this.announcementService.toggleAnnouncement(AnnouncementToggleData);
      res.status(200).json({ status: 'success', message: "toggle operation success" });

    } catch (err) {
      next(err);
    }
  };

  public deleteAnnouncement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { announcement_id: AnnouncementData } = req.params;
      const result = await this.announcementService.deleteAnnouncement(AnnouncementData);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

}

export default AnnouncementController;
