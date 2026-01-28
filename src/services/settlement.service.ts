import { HttpException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import { ObjectId } from 'mongodb';
import { CreateSettlementDto } from '@/dtos/settlement.dto';
import SettlementModel from '@/models/settlement.model';
import AdminModel from '@/models/admin.model';
import UserModel from '@/models/user.model';


class SettlementService {

    public settlement = SettlementModel;
    public admin = AdminModel;
    public user = UserModel;

    public async createNewSettlement(settlementData: CreateSettlementDto): Promise<void> {
        if (isEmpty(settlementData)) throw new HttpException(400, 'settlementData is empty');

        const { adminIdTo, adminIdFrom, ammount, type, remark } = settlementData;

        const newSettlement = new this.settlement({
            adminIdTo,
            adminIdFrom,
            ammount,
            type,
            remark
        });
        await newSettlement.save();
        return;
    }

    public async getSettlementById(id: string): Promise<any> {
        const adminId = new ObjectId(id);
        const admin = await this.admin.findById(adminId).lean();
        if (!admin) throw new HttpException(404, 'Admin not found');

        const populateAdminTo = admin.type === 'agent'
            ? { path: 'adminIdTo', model: 'User', select: '_id username' }
            : { path: 'adminIdTo', select: '_id username' };

        // find with adminIdFrom or adminIdTo
        const data = await this.settlement
            .find({ $or: [{ adminIdFrom: adminId }, { adminIdTo: adminId }] })
            .populate('adminIdFrom', '_id username')
            .populate(populateAdminTo)
            .lean();

        if (isEmpty(data)) throw new HttpException(404, 'Settlement not found');
        return data;
    }

    public async getSettlementUserById(id: string): Promise<any> {
        const userId = new ObjectId(id);
        const user = await this.user.findById(userId).lean();
        if (!user) throw new HttpException(404, 'User not found');

        // const populateAdminTo = admin.type === 'agent' 
        //     ? { path: 'adminIdTo', model: 'User' } 
        //     : 'adminIdTo';

        const data = await this.settlement
            .find({ adminIdTo: userId })
            .populate('adminIdFrom')
            .populate({ path: 'adminIdTo', model: 'User' })
            .lean();

        if (isEmpty(data)) throw new HttpException(404, 'Settlement not found');
        return data;
    }

    public async getSettlementToById(id: string): Promise<any> {
        const adminId = new ObjectId(id);
        const data = await this.settlement.find({ $or: [{ adminIdTo: adminId }] }).populate("adminIdTo").populate("adminIdFrom");
        if (isEmpty(data)) throw new HttpException(404, 'Settlement not found');
        return data;
    }

    public async getSettlementTotalById(id: string): Promise<any> {
        const adminId = new ObjectId(id);
        const data = await this.settlement.find({ $or: [{ adminIdTo: adminId }, { adminIdFrom: adminId }] });
        if (isEmpty(data)) throw new HttpException(404, 'Settlement not found');
        return data;
    }

}

export default SettlementService;
