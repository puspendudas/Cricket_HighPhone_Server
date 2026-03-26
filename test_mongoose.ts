import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { GetAllAdminDto } from './src/dtos/admin.dto';
import AdminModel from './src/models/admin.model';
import DB from './src/databases/index';
import mongoose from 'mongoose';

async function test() {
    await DB();

    const reqQuery = { type: 'admin' };
    const dto = plainToInstance(GetAllAdminDto, [reqQuery])[0];
    const query = { ...dto };

    console.log('--- Query constructed ---');
    console.log(query);

    console.log('--- Keys of query ---');
    console.log(Object.keys(query));

    mongoose.set('debug', true);

    try {
        const total = await AdminModel.countDocuments(query);
        console.log('--- Total ---');
        console.log(total);
    } catch (err) {
        console.error(err);
    }

    process.exit(0);
}

test();
