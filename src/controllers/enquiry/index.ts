import { NextFunction, Request, Response } from 'express';
import EnquiryService from '@/services/enquiry.service';
import { CreateEnquiryDto, GetEnquiryDto } from '@/dtos/enquiry.dto';

class EnquiryController {
  public enquiryService: EnquiryService;

  constructor() {
    this.enquiryService = new EnquiryService();
  }

  public createEnquiry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const enquiryData: CreateEnquiryDto = req.body;
      const result = await this.enquiryService.createEnquiry(enquiryData);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  public getAllEnquiry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const getEnquiryData: GetEnquiryDto = req.query;
      const result = await this.enquiryService.getAllEnquiry(getEnquiryData);
      res.status(200).json({ status: "success", ...result });
    } catch (err) {
      next(err);
    }
  }

//   public deleteNotice = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { notice_id: NoticeData } = req.params;
//       const result = await this.noticeService.deleteNotice(NoticeData);
//       res.status(200).json(result);
//     } catch (err) {
//       next(err);
//     }
//   }

}

export default EnquiryController;