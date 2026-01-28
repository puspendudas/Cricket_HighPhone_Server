import { HttpException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto'
import TransactionModel from '@/models/transaction.model';
import { CreateTransactionAgentDto, CreateTransactionDto, GetAllTransactionDto, GetUserTransactionDto, SwitchTransactionDto } from '@/dtos/transaction.dto';
import { Transaction } from '@/interfaces/transaction.interface';
import SettingModel from '@/models/setting.model';
import UserModel from '@/models/user.model';
import AdminModel from '@/models/admin.model';

class TransactionService {
  public transactionModel = TransactionModel;
  public settingsModel = SettingModel;
  public usersModel = UserModel;
  public adminsModel = AdminModel;

  public async getGlobalSettings() {
    return await this.settingsModel.findOne({ name: 'global' });
  }

  public async getUserById(transactionData: CreateTransactionDto) {
    return await this.usersModel.findById(transactionData.user_id).select(['transaction', 'wallet', 'fcm', 'upi_number', 'transfer', 'status', 'agent']);
  }

  public async getReceiverById(transactionData: CreateTransactionDto) {
    return await this.usersModel.findById(transactionData.receiver_id).select(['transaction', 'wallet', 'fcm', 'upi_number', 'transfer', 'status', 'agent']);
  }

  public async getAdminById(transactionData: CreateTransactionDto) {
    return await this.adminsModel.findById(transactionData.agent_id).select(['wallet', 'transfer', 'status']);
  }

  public validateTransaction(transactionData: CreateTransactionDto, user: any, globalSettings: any) {
    const { betting, deposit, withdraw, withdraw_open, withdraw_close, withdrawl_off_day } = globalSettings;

    if (user.upi_number === "-" && transactionData.transfer_type === "withdrawal" && transactionData.type === "mobile") {
      return { status: "failure", message: "User UPI number not set" };
    }

    const currentDateTime = new Date()
    const currentTimeIST = currentDateTime.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hourCycle: "h23" });
    const currentDay = currentDateTime.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", weekday: 'long' });
    const [hour, minute] = currentTimeIST.split(":").slice(0, 2);
    const currentTime = `${hour}:${minute}`;

    const dayWithdrawalSettings = {
      "Sunday": withdrawl_off_day.sunday,
      "Monday": withdrawl_off_day.monday,
      "Tuesday": withdrawl_off_day.tuesday,
      "Wednesday": withdrawl_off_day.wednesday,
      "Thursday": withdrawl_off_day.thursday,
      "Friday": withdrawl_off_day.friday,
      "Saturday": withdrawl_off_day.saturday
    };

    const isWithdrawalOpenToday = dayWithdrawalSettings[currentDay];
    switch (transactionData.type) {
      case 'bet': {
        if (!(betting.min <= transactionData.amount && transactionData.amount <= betting.max)) {
          return { status: "failure", message: "Amount is not within range" };
        }
        break;
      }
      case "admin": {
        if (!user.transfer || !user.status) {
          return { status: "failure", message: "Transfer is not allowed in this user" };
        }
        if (transactionData.transfer_type === "withdrawal") {
          if (Number(user.wallet) - Number(transactionData.amount) < 0) {
            return { status: "failure", message: "Not enough amount in wallet" };
          }
        }
        // if (!(transfer.min <= transactionData.amount && transactionData.amount <= transfer.max)) {
        //   return { status: "failure", message: "Amount is not within range" };
        // }
        break;
      }
      case "agent": {
        if (!user.transfer || !user.status) {
          return { status: "failure", message: "Transfer is not allowed in this user" };
        }
        if (transactionData.transfer_type === "withdrawal") {
          if (Number(user.wallet) - Number(transactionData.amount) < 0) {
            return { status: "failure", message: "Not enough amount in wallet" };
          }
        }
        // if (!(transfer.min <= transactionData.amount && transactionData.amount <= transfer.max)) {
        //   return { status: "failure", message: "Amount is not within range" };
        // }
        break;
      }
      case "mobile": {
        if (transactionData.transfer_type === "withdrawal") {
          if (!isWithdrawalOpenToday) {
            return { status: "failure", message: "Withdraw not allowed today." };
          }
          if (!(withdraw_open <= currentTime && currentTime <= withdraw_close)) {
            // console.log("time to withdraw");
            return { status: "failure", message: "Withdraw not allowed at this time." };
          }
          if (user.wallet < transactionData.amount) {
            return { status: "failure", message: "Not enough amount in wallet" };
          }
          if (!(withdraw.min <= transactionData.amount && transactionData.amount <= withdraw.max)) {
            return { status: "failure", message: "Amount is not within range" };
          }
        }
        if (transactionData.transfer_type === "user_transfer") {
          if (!user.transfer || !user.status) {
            return { status: "failure", message: "Transfer is not allowed in this user" };
          }
        }
        if (transactionData.transfer_type === "upi" || transactionData.transfer_type === "deposit") {
          if (!(Number(deposit.min) <= Number(transactionData.amount) && Number(transactionData.amount) <= Number(deposit.max))) {
            return { status: "failure", message: "Deposit amount is not within range" };
          }
        }
        break;
      }
    }
  }

  public async createTransactionObject(transactionData: CreateTransactionDto) {
    if (isEmpty(transactionData)) throw new HttpException(400, 'Transaction Data is empty');

    const newTransaction = {
      user_id: transactionData.user_id,
      amount: transactionData.amount,
      type: transactionData.type,
      // note: transactionData.note
    };

    const createTransactionData: Transaction = await this.transactionModel.create({ ...newTransaction });

    if (transactionData.type === "admin" || transactionData.type === "agent") {
      createTransactionData.transfer_type = transactionData.transfer_type;
      createTransactionData.agent_id = transactionData.agent_id;
    }

    if (transactionData.type === "mobile") {
      createTransactionData.transfer_type = transactionData.transfer_type;
    }

    if (transactionData.note !== undefined && transactionData.note !== '') {
      createTransactionData.note = transactionData.note;
    }

    if (transactionData.withdraw_type !== undefined && transactionData.withdraw_type !== '') {
      createTransactionData.withdraw_type = transactionData.withdraw_type;
    }

    return createTransactionData;
  }

  public async handleFileUpload(req: any, transactionData: CreateTransactionDto, transaction: any) {
    if (req.files && req.files.image) {
      if (Array.isArray(req.files.image)) {
        throw { status: 'failure', message: "Only 1 file upload is permitted" };
      }

      if (transactionData.transfer_type === "deposit" && transactionData.type === "mobile") {
        const { image } = req.files;
        const image_name = image.name;

        fs.mkdirSync(path.join(__dirname, '../public/transaction'), { recursive: true });

        const payment_proof = crypto.randomUUID() + path.extname(image_name);
        const filepath = path.join(__dirname, `../public/transaction/${payment_proof}`);

        await image.mv(filepath);
        transaction.payment_proof = payment_proof
        return payment_proof;
      }
    }
    return 'n/a';
  }

  public setTransactionDetails(transactionData: CreateTransactionDto, transaction: any, user: any, agent: any, receiveruser: any) {
    if (transactionData.type === "mobile" && (transactionData.status === "success" || transactionData.status === "failure")) {
      transaction.tax_id = transactionData.tax_id ? transactionData.tax_id : "n/a"
      transaction.ref_id = transactionData.ref_id ? transactionData.ref_id : "n/a"
      transaction.status = transactionData.status
    }
    if (transactionData.type === "mobile" && transactionData.status === "failure" && transactionData.transfer_type === "upi") {
      transaction.prev_balance = user.wallet
      transaction.current_balance = user.wallet
    }
    if (transactionData.type === "mobile" && transactionData.status === "success" && transactionData.transfer_type === "upi") {
      transaction.prev_balance = user.wallet
      user.wallet = Number(user.wallet) + Number(transactionData.amount)
      transaction.current_balance = user.wallet
    }
    if (transactionData.type === 'mobile' && transactionData.transfer_type === "withdrawal") {
      transaction.prev_balance = user.wallet
      user.wallet = Number(user.wallet) - Number(transactionData.amount)
      transaction.current_balance = user.wallet
    }
    if (transactionData.type === 'mobile' && transactionData.transfer_type === "user_transfer") {
      transaction.prev_balance = user.wallet
      user.wallet = Number(user.wallet) - Number(transactionData.amount)
      transaction.current_balance = user.wallet
      receiveruser.wallet = Number(receiveruser.wallet) + Number(transactionData.amount)
      transaction.status = "completed"
    }
    if (transactionData.type === 'admin' && transactionData.transfer_type === "withdrawal") {
      transaction.prev_balance = user.wallet
      user.wallet = Number(user.wallet) - Number(transactionData.amount)
      transaction.current_balance = user.wallet
      transaction.status = "completed"
    }
    if (transactionData.type === 'agent' && transactionData.transfer_type === "withdrawal") {
      transaction.prev_balance = user.wallet
      user.wallet = Number(user.wallet) - Number(transactionData.amount)
      transaction.current_balance = user.wallet
      agent.wallet = Number(agent.wallet) + Number(transactionData.amount)
      transaction.status = "completed"
    }
    if (transactionData.type === "admin" && transactionData.transfer_type === "deposit") {
      transaction.prev_balance = user.wallet
      user.wallet = Number(user.wallet) + Number(transactionData.amount)
      transaction.current_balance = user.wallet
      transaction.status = "completed"
    }
    if (transactionData.type === "agent" && transactionData.transfer_type === "deposit") {
      transaction.prev_balance = user.wallet
      user.wallet = Number(user.wallet) + Number(transactionData.amount)
      transaction.current_balance = user.wallet
      agent.wallet = Number(agent.wallet) - Number(transactionData.amount)
      transaction.status = "completed"
    }
    if (transactionData.type === "mobile" && transactionData.transfer_type === "deposit") {
      transaction.prev_balance = user.wallet
      transaction.current_balance = user.wallet
    }

    if ((transactionData.agent_id !== undefined && transactionData.agent_id !== '') || user.agent !== undefined) {
      transaction.agent_id = user.agent;
    }
    if (transactionData.receiver_id !== undefined && transactionData.receiver_id !== '') {
      transaction.receiver_id = receiveruser.id;
    }
  }

  public async saveTransaction(transaction: any, user: any, agent: any, receiveruser: any) {
    await transaction.save();
    user.transaction.push(transaction._id);
    await user.save();
    if (receiveruser !== undefined) {
      await receiveruser.save();
    }
    if (agent !== undefined) {
      await agent.save();
    }
  }

  public async switchStatus(transactionData: SwitchTransactionDto, req?: any) {
    if (isEmpty(transactionData)) throw new HttpException(400, 'marketData is empty');
    const { id, note, status, amount, approved_by, receipt } = transactionData;
    const foundTransaction = await this.transactionModel.findById(id);

    if (!foundTransaction) {
      throw new HttpException(404, 'Transaction not found');
    }

    if (foundTransaction.status !== "pending") {
      throw new HttpException(400, 'Transaction not pending');
    }

    if (note !== undefined && note !== '') {
      foundTransaction.note = note;
    }

    if (req.files) {
      if (Array.isArray(req.files.image)) {
        throw new HttpException(400, 'Only one file upload is permitted');
      }

      const { image } = req.files;
      const imageName = image.name;
      const receiptDir = path.join(__dirname, '../public/receipt');

      fs.mkdirSync(receiptDir, { recursive: true });

      const receiptName = crypto.randomUUID() + path.extname(imageName);
      const filePath = path.join(receiptDir, receiptName);

      await image.mv(filePath);
      foundTransaction.receipt = receiptName;
    }
    const foundUser = await this.usersModel.findById(foundTransaction.user_id);
    const foundAgent = await this.adminsModel.findById(approved_by).select(['wallet', 'transfer', 'status', 'type']);
    if (amount !== undefined) {
      foundTransaction.amount = amount;
    }
    if (receipt !== undefined) {
      foundTransaction.receipt = receipt;
    }

    if (status === 'completed') {
      if (foundTransaction.transfer_type === 'deposit') {
        foundTransaction.prev_balance = foundUser.wallet;
        foundUser.wallet += foundTransaction.amount;
        foundTransaction.current_balance = foundUser.wallet;
        await foundUser.save();
      }
      if (foundTransaction.transfer_type === 'withdrawal' && foundTransaction.type === 'mobile' && foundAgent.type === "agent") {
        foundAgent.wallet += Number(foundTransaction.amount)
        await foundAgent.save();
      }
    } else if (status === 'cancelled' && foundTransaction.transfer_type === 'withdrawal') {
      foundUser.wallet += foundTransaction.amount;
      foundTransaction.current_balance = foundUser.wallet;
      await foundUser.save();
    }

    foundTransaction.status = status;
    foundTransaction.approved_by = approved_by;
    await foundTransaction.save();
  }

  public async getAllTransactions(queryDto: GetAllTransactionDto) {
    const { skip, query_date, status, type, user_id, market_id, transfer_type, count, agent_id } = queryDto;
    let from, to;
    if (query_date) {
      const date = new Date(query_date);
      date.setDate(date.getDate() - 1);
      from = date.toISOString().split('T')[0] + "T18:30:00.000Z";
      to = query_date + "T18:29:59.999Z";
    }

    const query: any = {};
    if (transfer_type) query.transfer_type = String(transfer_type);
    if (market_id) query.market_id = String(market_id);
    if (user_id) query.user_id = String(user_id);
    if (agent_id) query.agent_id = String(agent_id);
    if (status) query.status = String(status);
    if (type) query.type = String(type);
    if (query_date) query.createdAt = { $gte: new Date(from), $lt: new Date(to) };

    const total = await this.transactionModel.countDocuments(query);
    const limit = count ? Number(count) : total;
    const transactionList = await this.transactionModel.find(query)
      .populate('user_id bet_id receiver_id approved_by agent_id market_id')
      .sort({ createdAt: -1 })
      .skip(Number(skip) * limit)
      .limit(limit);

    if (!transactionList) throw new HttpException(400, "Error getting list");

    return { total, data: transactionList };
  }

  public async geUserTransactions(queryDto: GetUserTransactionDto) {
    const { skip, from_date, to_date, status, type, user_id, bet_id, market_id, transfer_type, count } = queryDto;
    if (isEmpty(queryDto.user_id)) throw new HttpException(400, 'user betData is empty');
    const user = await this.usersModel.findById({ _id: queryDto.user_id })
    if (!user) {
      throw new HttpException(404, 'User not found');
    }
    let from, to;
    if (from_date && to_date) {
      const f_date = new Date(from_date);
      const t_date = new Date(to_date);

      f_date.setUTCDate(f_date.getUTCDate() - 1);

      from = `${f_date.toISOString().split('T')[0]}T18:30:00.000Z`;
      to = `${t_date.toISOString().split('T')[0]}T18:29:59.999Z`;
    }

    const query: any = {};
    if (transfer_type) query.transfer_type = String(transfer_type);
    if (market_id) query.market_id = String(market_id);
    if (user_id) query.user_id = String(user_id);
    if (bet_id) query.user_id = String(bet_id);
    if (status) query.status = String(status);
    if (type) query.type = String(type);
    if (from_date && to_date) query.createdAt = { $gte: String(from), $lt: String(to) };

    const total = await this.transactionModel.countDocuments(query);
    const limit = count ? Number(count) : total;
    const transactionList = await this.transactionModel.find(query)
      .populate('user_id bet_id receiver_id approved_by agent_id')
      .sort({ createdAt: -1 })
      .skip(Number(skip) * limit)
      .limit(limit);

    if (!transactionList) throw new HttpException(400, "Error getting list");

    return { total, data: transactionList };
  }

  // Admin to Agent transfer

  public async getAgentById(transactionData: CreateTransactionAgentDto) {
    return await this.adminsModel.findById(transactionData.agent_id).select(['transaction', 'wallet', 'fcm', 'upi_number', 'transfer', 'status']);
  }

  public validateTransactionAgent(transactionData: CreateTransactionAgentDto, user: any, globalSettings: any) {
    const { withdraw, withdraw_open, withdraw_close, withdrawl_off_day } = globalSettings;

    if (user.upi_number === "-" && transactionData.transfer_type === "withdrawal" && transactionData.type === "mobile") {
      return { status: "failure", message: "User UPI number not set" };
    }

    const currentDateTime = new Date()
    const currentTimeIST = currentDateTime.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hourCycle: "h23" });
    const currentDay = currentDateTime.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", weekday: 'long' });
    const [hour, minute] = currentTimeIST.split(":").slice(0, 2);
    const currentTime = `${hour}:${minute}`;

    const dayWithdrawalSettings = {
      "Sunday": withdrawl_off_day.sunday,
      "Monday": withdrawl_off_day.monday,
      "Tuesday": withdrawl_off_day.tuesday,
      "Wednesday": withdrawl_off_day.wednesday,
      "Thursday": withdrawl_off_day.thursday,
      "Friday": withdrawl_off_day.friday,
      "Saturday": withdrawl_off_day.saturday
    };

    const isWithdrawalOpenToday = dayWithdrawalSettings[currentDay];
    switch (transactionData.type) {
      case "a_admin": {
        if (transactionData.transfer_type === "withdrawal") {
          if (Number(user.wallet) - Number(transactionData.amount) < 0) {
            return { status: "failure", message: "Not enough amount in wallet" };
          }
        }
        // if (!(transfer.min <= transactionData.amount && transactionData.amount <= transfer.max)) {
        //   return { status: "failure", message: "Amount is not within range" };
        // }
        break;
      }
      case "a_agent": {
        if (transactionData.transfer_type === "withdrawal") {
          if (Number(user.wallet) - Number(transactionData.amount) < 0) {
            return { status: "failure", message: "Not enough amount in wallet" };
          }
          if (!isWithdrawalOpenToday) {
            return { status: "failure", message: "Withdrawal not allowed today." };
          }
          if (!(withdraw_open <= currentTime && currentTime <= withdraw_close)) {
            // console.log("time to withdraw");
            return { status: "failure", message: "Withdrawal not allowed at this time." };
          }
          if (user.wallet < transactionData.amount) {
            return { status: "failure", message: "Not enough amount in wallet" };
          }
          if (!(withdraw.min <= transactionData.amount && transactionData.amount <= withdraw.max)) {
            return { status: "failure", message: "Amount is not within range" };
          }
        }
        // if (!(transfer.min <= transactionData.amount && transactionData.amount <= transfer.max)) {
        //   return { status: "failure", message: "Amount is not within range" };
        // }
        break;
      }
    }
  }

  public async createTransactionObjectAgent(transactionData: CreateTransactionAgentDto) {
    if (isEmpty(transactionData)) throw new HttpException(400, 'Transaction Data is empty');

    const newTransaction = {
      agent_id: transactionData.agent_id,
      amount: transactionData.amount,
      type: transactionData.type,
      // note: transactionData.note
    };

    const createTransactionData: Transaction = await this.transactionModel.create({ ...newTransaction });

    if (transactionData.type === "a_admin") {
      createTransactionData.transfer_type = transactionData.transfer_type;
    }

    if (transactionData.type === "a_agent") {
      createTransactionData.transfer_type = transactionData.transfer_type;
    }

    if (transactionData.note !== undefined && transactionData.note !== '') {
      createTransactionData.note = transactionData.note;
    }

    if (transactionData.withdraw_type !== undefined && transactionData.withdraw_type !== '') {
      createTransactionData.withdraw_type = transactionData.withdraw_type;
    }

    return createTransactionData;
  }

  public async handleFileUploadAgent(req: any, transactionData: CreateTransactionAgentDto, transaction: any) {
    if (req.files && req.files.image) {
      if (Array.isArray(req.files.image)) {
        throw { status: 'failure', message: "Only 1 file upload is permitted" };
      }

      if (transactionData.transfer_type === "deposit" && transactionData.type === "mobile") {
        const { image } = req.files;
        const image_name = image.name;

        fs.mkdirSync(path.join(__dirname, '../public/transaction'), { recursive: true });

        const payment_proof = crypto.randomUUID() + path.extname(image_name);
        const filepath = path.join(__dirname, `../public/transaction/${payment_proof}`);

        await image.mv(filepath);
        transaction.payment_proof = payment_proof
        return payment_proof;
      }
    }
    return 'n/a';
  }

  public setTransactionDetailsAgent(transactionData: CreateTransactionAgentDto, transaction: any, agent: any) {
    if (transactionData.transfer_type === 'withdrawal' && transactionData.type === "a_agent") {
      transaction.prev_balance = agent.wallet
      agent.wallet = Number(agent.wallet) - Number(transactionData.amount)
      transaction.current_balance = agent.wallet
    }
    if (transactionData.type === 'a_admin' && transactionData.transfer_type === "withdrawal") {
      transaction.prev_balance = agent.wallet
      agent.wallet = Number(agent.wallet) - Number(transactionData.amount)
      transaction.current_balance = agent.wallet
      transaction.status = "completed"
    }
    if (transactionData.type === "a_admin" && transactionData.transfer_type === "deposit") {
      transaction.prev_balance = agent.wallet
      agent.wallet = Number(agent.wallet) + Number(transactionData.amount)
      transaction.current_balance = agent.wallet
      transaction.status = "completed"
    }
  }

  public async saveTransactionAgent(transaction: any, agent: any) {
    await transaction.save();
    agent.transaction.push(transaction._id);
    await agent.save();
  }

}

export default TransactionService;
