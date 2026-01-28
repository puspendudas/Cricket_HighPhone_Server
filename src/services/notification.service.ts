import { HttpException } from '@exceptions/HttpException';
import TransactionModel from '@/models/transaction.model';
import SettingModel from '@/models/setting.model';
import UserModel from '@/models/user.model';
import SliderModel from '@/models/slider.model';
import NotificationModel from '@/models/notification.model';
import firebase from 'firebase-admin';
import { CreateNotificationDto, GetNotificationDto, ToggleNotificationDto } from '@/dtos/notification.dto';
import { isEmpty } from '@utils/util';
import { User } from '@/interfaces/users.interface';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { NotificationRespond } from '@/interfaces/notification.interface';


class NotificationService {
    public transactionModel = TransactionModel;
    public settingsModel = SettingModel;
    public usersModel = UserModel;
    public sliderModel = SliderModel;
    public notificationModel = NotificationModel;

    public async createNotifications(notificationData: CreateNotificationDto,): Promise<void> {
        // Check if the notificationData is empty and throw an exception if true
        if (isEmpty(notificationData)) throw new HttpException(400, 'notificationData is empty');
    
        // Log the notification data for debugging purposes
        // let link;
        // if (req.files && req.files.image) {
        //     if (Array.isArray(req.files.image)) {
        //         throw new HttpException(400, 'Only one file upload is permitted');
        //     }
    
        //     const { image } = req.files;
        //     const imageName = image.name as string; // Ensure imageName is a primitive string
        //     const imageDirectory: string = path.join(__dirname, '../public/notification');
        //     fs.mkdirSync(imageDirectory, { recursive: true });
    
        //     link = crypto.randomUUID() + path.extname(imageName);
        //     const filepath: string = path.join(imageDirectory, String(link));
        //     await image.mv(filepath);
        // }
    
        // Parse the user_id string into an array of ObjectId
        let userIds: any;
        if (String(notificationData.all_user) === "false") {
            userIds = notificationData.user_id.split(',').map(id => new mongoose.Types.ObjectId(id.trim().replace(/"/g, '')));
        }
    
        const dataNotification = {
            title: notificationData.title,
            body: notificationData.body,
            url: notificationData.url,
            all_user: notificationData.all_user,
            user_id: userIds,
            link: notificationData.link
        };
        const newNotification = new this.notificationModel({ ...dataNotification });
        await newNotification.save();
    }

    public async getAllNotification(getNoticeData: GetNotificationDto): Promise<{ total: number, data: any[] }> {
        const { id, skip, count } = getNoticeData
        const query: { [key: string]: string } = {};
        if (id !== undefined) query._id = String(id);
        const total = await this.notificationModel.countDocuments(query);
        const limit = count !== undefined ? Number(count) : total
        const notice_list = await this.notificationModel.find(query).skip(Number(skip) * limit).limit(limit);
        return { total, data: notice_list };
    }

    public async toggleNotification(noticeToggleData: ToggleNotificationDto): Promise<NotificationRespond> {
        if (isEmpty(noticeToggleData)) throw new HttpException(400, 'maket Data is empty');
        const foundMarket = await this.notificationModel.findById(noticeToggleData.id);
        if (!foundMarket) {
            throw new HttpException(400, "No notification found for the id");
        }
        foundMarket.status = !foundMarket.status;
        await foundMarket.save();
        return foundMarket
    }

    public async deleteNotification(NoticeData: string): Promise<{ status: string, message: string }> {
        if (isEmpty(NoticeData)) throw new HttpException(400, 'NoticeData is empty');

        const data = await this.notificationModel.findById(NoticeData);
        if (!data) {
            throw new HttpException(404, 'No notice found');
        }

        if (data.link === "-") {
            await this.notificationModel.findByIdAndDelete(NoticeData);
            return { status: 'success', message: 'operation successful' };
        }
        const img_name = data.link;
        const imagePath = path.join(__dirname, '../public/notification', String(img_name));

        const fileExists = await new Promise<boolean>((resolve) => {
            fs.access(imagePath, fs.constants.F_OK, (err) => {
                resolve(!err);
            });
        });

        if (!fileExists) {
            await this.notificationModel.findByIdAndDelete(NoticeData);
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

        await this.notificationModel.findByIdAndDelete(NoticeData);
        return { status: 'success', message: 'operation successful' };
    }

    public async sendNotifications(notificationData: ToggleNotificationDto): Promise<void> {
        // Check if the notificationData is empty and throw an exception if true
        if (isEmpty(notificationData)) throw new HttpException(400, 'notificationData is empty');

        const detalisData = await this.notificationModel.findById(notificationData.id);
        if (!detalisData) throw new HttpException(404, "No Notification found for the id");
        if (!detalisData.status) throw new HttpException(400, "Notification status does not allow to send");

        let userList: User[] = [];
        // const images_url = `https://kalyanbadsha.in.net/api/v1/misc/images?type=notification&name=${detalisData.link}`

        // Fetch all users if the 'all_user' flag is true
        if (detalisData.all_user) {
            userList = await this.usersModel.find();
        } else {
            // Fetch selected users based on provided user IDs in notificationData
            if (detalisData.user_id && detalisData.user_id.length > 0) {
                userList = await this.usersModel.find({ _id: { $in: detalisData.user_id } });
            }
        }

        // Create an array of promises for sending notifications
        const promises = userList.map(async (user) => {
            if (user.fcm && user.fcm !== '-' && user.personal_notification && user.status) {
                const message = {
                    notification: {
                        title: detalisData.title as string,
                        body: detalisData.body as string,
                        image: detalisData.link as string // URL to the image
                    },
                    data: {
                        url: detalisData.url as string // URL to the website
                    },
                    token: user.fcm
                };
                // console.log(message);


                try {
                    // Send the message using Firebase Cloud Messaging
                    await firebase.messaging().send(message);
                } catch (error) {
                    console.error('Error sending message:', error);
                }
            }
        });

        // Wait for all the promises to resolve
        await Promise.all(promises);
    }

}

export default NotificationService;