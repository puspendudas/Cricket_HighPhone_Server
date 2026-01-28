import { HttpException } from '@exceptions/HttpException';
import path from 'path';
import fs from 'fs';
import { isEmpty } from '@utils/util';
import TransactionModel from '@/models/transaction.model';
import SettingModel from '@/models/setting.model';
import UserModel from '@/models/user.model';
import SliderModel from '@/models/slider.model';
import { SliderDto } from '@/dtos/slider.dto';
import SLIDERDATA from '../assets/slider.data.json';


class SliderService {
    public transactionModel = TransactionModel;
    public settingsModel = SettingModel;
    public usersModel = UserModel;
    public sliderModel = SliderModel;

    public async createNewSlider(sliderData: SliderDto): Promise<void> {
        if (isEmpty(sliderData)) throw new HttpException(400, 'sliderData is empty');

        const { tag, link } = sliderData;
        if (!tag || !link) throw new HttpException(400, 'Tag is required');

        // let link = '';

        // if (req.files && req.files.image) {
            // if (Array.isArray(req.files.image)) {
            //     throw new HttpException(400, "Only one file upload is permitted");
            // }
            // const { image } = req.files;
            
            // const imageName = image.name;
            // const imageDirectory = path.join(__dirname, '../public/slider');
            // fs.mkdirSync(imageDirectory, { recursive: true });
            // link = crypto.randomUUID() + path.extname(imageName);
            // const filepath = path.join(imageDirectory, link);
            // await image.mv(filepath);
            const newSlider = new this.sliderModel({
                tag,
                link
            });
            // newSlider.link = link;
            await newSlider.save();
            return;
        // }
    }

    public async getSliders(): Promise<any[]> {
        const data = await this.sliderModel.find();
        return data;
    }

    public async getSlidersApp(userId: string): Promise<any[]> {
        const userList = await this.usersModel.findById(userId).select('-mpin -__v -password')
        let data: any = await this.sliderModel.find({state: true});
        if (!userList.status) {
            data = SLIDERDATA
        }
        return data;
    }

    public async deleteSlider(sliderData: string): Promise<{ status: string, message: string }> {
        if (isEmpty(sliderData)) throw new HttpException(400, 'sliderData is empty');

        const data = await this.sliderModel.findById(sliderData);
        if (!data) {
            throw new HttpException(404, 'No slider found');
        }

        const img_name = data.link;
        const imagePath = path.join(__dirname, '../public/slider', String(img_name));

        const fileExists = await new Promise<boolean>((resolve) => {
            fs.access(imagePath, fs.constants.F_OK, (err) => {
                resolve(!err);
            });
        });

        if (!fileExists) {
            await this.sliderModel.findByIdAndDelete(sliderData);
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

        await this.sliderModel.findByIdAndDelete(sliderData);
        return { status: 'success', message: 'operation successful' };
    }

    public async toggleSlider(sliderData: string): Promise<{ status: string, message: string }> {
        if (isEmpty(sliderData)) throw new HttpException(400, 'sliderData is empty');

        const data = await this.sliderModel.findById(sliderData);
        if (!data) {
            throw new HttpException(404, 'No slider found');
        }
        data.state = !data.state
        await data.save()
        return { status: 'success', message: 'operation successful' };
    }

}

export default SliderService;