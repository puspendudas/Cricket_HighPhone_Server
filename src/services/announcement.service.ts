import { HttpException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';

import { AnnouncementRespond } from '@/interfaces/announcement.interface';
import AnnouncementModel from '@/models/announcement.model';
import { CreateAnnouncementDto, GetAnnouncementDto, ToggleAnnouncementDto } from '@/dtos/announcement.dto';

class AnnouncementService {
    public announcementModel = AnnouncementModel;

    public async createAnnouncement(announcementData: CreateAnnouncementDto): Promise<{ status: string, message: string }> {
        if (isEmpty(announcementData)) throw new HttpException(400, 'announcementData is empty.');

        const { title, body, user_type, match_id } = announcementData;

        if (!user_type) throw new HttpException(400, 'Need user_type');

        const new_announcement = new this.announcementModel({ title, body, user_type, match_id });

        await new_announcement.save();

        return { status: 'success', message: 'Announcement creation successful' };
    }

    public async getAllAnnouncements(getAnnouncementData: GetAnnouncementDto): Promise<{ total: number, data: any[] }> {
        const { id, skip, count } = getAnnouncementData
        const query: { [key: string]: string } = {};
        if (id !== undefined) query._id = String(id);
        const total = await this.announcementModel.countDocuments(query);
        const limit = count !== undefined ? Number(count) : total
        const announcement_list = await this.announcementModel.find(query).populate('match_id').skip(Number(skip) * limit).limit(limit);
        return { total, data: announcement_list };
    }

    public async toggleAnnouncement(announcementToggleData: ToggleAnnouncementDto): Promise<AnnouncementRespond> {
        if (isEmpty(announcementToggleData)) {
            throw new HttpException(400, 'Announcement data is empty');
        }
        const foundAnnouncement = await this.announcementModel.findById(announcementToggleData.id);
        if (!foundAnnouncement) {
            throw new HttpException(400, "No announcement found for the id");
        }
        // Set the status of the specified notice to true
        foundAnnouncement.status = !foundAnnouncement.status;

        // // Set the status of all other notices to false
        // await this.announcementModel.updateMany(
        //     { _id: { $ne: announcementToggleData.id } }, // All notices except the one with the specified ID
        //     { $set: { status: false } }
        // );

        // Save the updated specified notice
        await foundAnnouncement.save();
        return foundAnnouncement;
    }

    public async deleteAnnouncement(AnnouncementData: string): Promise<{ status: string, message: string }> {
        if (isEmpty(AnnouncementData)) throw new HttpException(400, 'AnnouncementData is empty');

        const data = await this.announcementModel.findById(AnnouncementData);
        if (!data) {
            throw new HttpException(404, 'No announcement found');
        }

        await this.announcementModel.findByIdAndDelete(AnnouncementData);
        return { status: 'success', message: 'operation successful' };
    }

}

export default AnnouncementService;
