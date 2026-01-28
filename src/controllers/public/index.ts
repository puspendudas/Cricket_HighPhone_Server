import SettingModel from '@/models/setting.model';
import { NextFunction, Request, Response } from 'express';


class PublicController {
    public settingsModel = SettingModel;


    public getLinks = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const settingsDoc = await this.settingsModel.findOne({ name: "global" });

            if (!settingsDoc) {
                return res.status(200).json({ status: "failure", message: "error getting settings" });
            }
            const { app_link, whatsapp, mobile, telegram, email_1, email_2, webtoggle, web_app_link, twitter } = settingsDoc;

            return res.status(200).json({ status: "success", app_link, whatsapp, mobile, telegram, email_1, email_2, webtoggle, web_app_link, twitter });
        } catch (error) {
            next(error);
        }
    };

}

export default PublicController;