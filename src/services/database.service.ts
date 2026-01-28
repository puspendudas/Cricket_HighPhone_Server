import mongoose from 'mongoose';

class DatabaseService {
    public async startSession() {
        return await mongoose.startSession();
    }

    public async commitTransaction(session: mongoose.ClientSession) {
        await session.commitTransaction();
    }

    public async abortTransaction(session: mongoose.ClientSession) {
        await session.abortTransaction();
    }

    public async endSession(session: mongoose.ClientSession) {
        await session.endSession();
    }
}

export default DatabaseService;
