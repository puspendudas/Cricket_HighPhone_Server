import { HttpException } from '@exceptions/HttpException';
import TransactionModel from '@/models/transaction.model';
import SettingModel from '@/models/setting.model';
import UserModel from '@/models/user.model';
import SliderModel from '@/models/slider.model';
import NotificationModel from '@/models/notification.model';
import { isEmpty } from '@utils/util';
import path from 'path';
import fs from 'fs';

import { CreateNoticeDto, GetNoticeDto, ToggleNoticeDto } from '@/dtos/notice.dto';
import NoticeModel from '@/models/notice.model';
import { NoticeRespond } from '@/interfaces/notice.interface';

class NoticeService {
    public transactionModel = TransactionModel;
    public settingsModel = SettingModel;
    public usersModel = UserModel;
    public sliderModel = SliderModel;
    public notificationModel = NotificationModel;
    public noticeModel = NoticeModel;

    public async createNotice(noticeData: CreateNoticeDto): Promise<{ status: string, message: string }> {
        if (isEmpty(noticeData)) throw new HttpException(400, 'noticeData is empty.');

        const { title, body, url, button, link } = noticeData;

        if (!button) throw new HttpException(400, 'Need button');

        const new_notice = new this.noticeModel({ title, body, url, button, link });

        // if (req.files && req.files.image) {
        //     if (Array.isArray(req.files.image)) {
        //         throw new HttpException(400, 'Only one file upload is permitted');
        //     }

        //     const { image } = req.files;
        //     const imageName = image.name as string; // Ensure imageName is a primitive string
        //     const imageDirectory: string = path.join(__dirname, '../public/notice');
        //     fs.mkdirSync(imageDirectory, { recursive: true });

        //     new_notice.link = crypto.randomUUID() + path.extname(imageName);
        //     const filepath: string = path.join(imageDirectory, String(new_notice.link));
        //     await image.mv(filepath);
        // }

        await new_notice.save();

        return { status: 'success', message: 'Notice creation successful' };
    }

    public async getAllNotices(getNoticeData: GetNoticeDto): Promise<{ total: number, data: any[] }> {
        const { id, skip, count } = getNoticeData
        const query: { [key: string]: string } = {};
        if (id !== undefined) query._id = String(id);
        const total = await this.noticeModel.countDocuments(query);
        const limit = count !== undefined ? Number(count) : total
        const notice_list = await this.noticeModel.find(query).skip(Number(skip) * limit).limit(limit);
        return { total, data: notice_list };
    }

    public async getAllNoticesApp(userId: string, getNoticeData: GetNoticeDto): Promise<{ total: number, data: any[] }> {
        try {
            const { id } = getNoticeData;
            const userList = await this.usersModel.findById(userId).select('-mpin -__v')
            const query: { [key: string]: any } = { status: true };
            if (id !== undefined) {
                query._id = String(id);
            }
            const total = await this.noticeModel.countDocuments(query);
            let notice_list: any = await this.noticeModel.find(query)
            if (!userList.status) {
                notice_list = ""
            }
            return { total, data: notice_list };
        } catch (error) {
            throw new Error(`Failed to fetch notices: ${error.message}`);
        }
    }

    public async toggleNotice(noticeToggleData: ToggleNoticeDto): Promise<NoticeRespond> {
        if (isEmpty(noticeToggleData)) {
            throw new HttpException(400, 'Notice data is empty');
        }
        const foundNotice = await this.noticeModel.findById(noticeToggleData.id);
        if (!foundNotice) {
            throw new HttpException(400, "No notice found for the id");
        }
        // Set the status of the specified notice to true
        foundNotice.status = !foundNotice.status;
        // Set the status of all other notices to false
        await this.noticeModel.updateMany(
            { _id: { $ne: noticeToggleData.id } }, // All notices except the one with the specified ID
            { $set: { status: false } }
        );
        // Save the updated specified notice
        await foundNotice.save();
        return foundNotice;
    }
    
    public async deleteNotice(NoticeData: string): Promise<{ status: string, message: string }> {
        if (isEmpty(NoticeData)) throw new HttpException(400, 'NoticeData is empty');

        const data = await this.noticeModel.findById(NoticeData);
        if (!data) {
            throw new HttpException(404, 'No notice found');
        }

        if (data.link === "-") {
            await this.noticeModel.findByIdAndDelete(NoticeData);
            return { status: 'success', message: 'operation successful' };
        }
        const img_name = data.link;
        const imagePath = path.join(__dirname, '../public/notice', String(img_name));

        const fileExists = await new Promise<boolean>((resolve) => {
            fs.access(imagePath, fs.constants.F_OK, (err) => {
                resolve(!err);
            });
        });

        if (!fileExists) {
            await this.noticeModel.findByIdAndDelete(NoticeData);
            throw new HttpException(404, 'Image file not found, delete only ID');
        }

        await new Promise<void>((resolve, reject) => {
            fs.unlink(imagePath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        await this.noticeModel.findByIdAndDelete(NoticeData);
        return { status: 'success', message: 'operation successful' };
    }

}

export default NoticeService;