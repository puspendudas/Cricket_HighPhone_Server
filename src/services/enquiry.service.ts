import { HttpException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import { CreateEnquiryDto, GetEnquiryDto } from '@/dtos/enquiry.dto';
import EnquiryModel from '@/models/enquiry.model';

class EnquiryService {
    public EnquiryModel = EnquiryModel;


    public async createEnquiry(enquiryData: CreateEnquiryDto): Promise<{ status: string, message: string }> {
        if (isEmpty(enquiryData)) throw new HttpException(400, 'noticeData is empty.');
        const { name, mobile, message } = enquiryData;
        if (!name || !message ||!mobile) throw new HttpException(400, 'Need name, message and mobile');
        const new_enquiry = new this.EnquiryModel({ name, mobile, message });
        await new_enquiry.save();
        return { status: 'success', message: 'Enquiry creation successful' };
    }

    public async getAllEnquiry(getEnquiryData: GetEnquiryDto): Promise<{ total: number, data: any[] }> {
        const { id, skip, count } = getEnquiryData
        const query: { [key: string]: string } = {};
        if (id !== undefined) query._id = String(id);
        const total = await this.EnquiryModel.countDocuments(query);
        const limit = count !== undefined ? Number(count) : total
        const enquiry_list = await this.EnquiryModel.find(query).skip(Number(skip) * limit).limit(limit);
        return { total, data: enquiry_list };
    }
    
    // public async deleteNotice(NoticeData: string): Promise<{ status: string, message: string }> {
    //     if (isEmpty(NoticeData)) throw new HttpException(400, 'NoticeData is empty');

    //     const data = await this.noticeModel.findById(NoticeData);
    //     if (!data) {
    //         throw new HttpException(404, 'No notice found');
    //     }

    //     if (data.link === "-") {
    //         await this.noticeModel.findByIdAndDelete(NoticeData);
    //         return { status: 'success', message: 'operation successful' };
    //     }
    //     const img_name = data.link;
    //     const imagePath = path.join(__dirname, '../public/notice', String(img_name));

    //     const fileExists = await new Promise<boolean>((resolve) => {
    //         fs.access(imagePath, fs.constants.F_OK, (err) => {
    //             resolve(!err);
    //         });
    //     });

    //     if (!fileExists) {
    //         await this.noticeModel.findByIdAndDelete(NoticeData);
    //         throw new HttpException(404, 'Image file not found, delete only ID');
    //     }

    //     await new Promise<void>((resolve, reject) => {
    //         fs.unlink(imagePath, (err) => {
    //             if (err) {
    //                 reject(err);
    //             } else {
    //                 resolve();
    //             }
    //         });
    //     });

    //     await this.noticeModel.findByIdAndDelete(NoticeData);
    //     return { status: 'success', message: 'operation successful' };
    // }

}

export default EnquiryService;