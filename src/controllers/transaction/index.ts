import { NextFunction, Request, Response } from 'express';
import TransactionService from '@/services/transaction.service';
import { CreateTransactionAgentDto, CreateTransactionDto, GetAllTransactionDto, GetUserTransactionDto, SwitchTransactionDto } from '@/dtos/transaction.dto';
import DatabaseService from '@/services/database.service';

class TransactionController {
  public transactionService: TransactionService; DatabaseService
  public databaseService: DatabaseService;

  constructor() {
    this.transactionService = new TransactionService();
    this.databaseService = new DatabaseService();
  }

  public createTransaction = async(req: Request, res: Response, next: NextFunction) => {

    let session = null;

    try {
      session = await this.databaseService.startSession();
      session.startTransaction();

      const transactionData: CreateTransactionDto = req.body;

      const globalSettings = await this.transactionService.getGlobalSettings();

      const foundUser = await this.transactionService.getUserById(transactionData);
      let foundReceiverUser 
      let foundAdmin
      if( transactionData.agent_id !== undefined){
        foundAdmin = await this.transactionService.getAdminById(transactionData);
        if (!foundAdmin) { return res.status(404).json({ status: "failure", message: "No Agent found" })}
        if (!foundAdmin.status) { return res.status(400).json({ status: "failure", message: "Agent not active" })}
        if (!foundAdmin.transfer) { return res.status(400).json({ status: "failure", message: "Agent not allow to transaction" })}
      }

      if (!globalSettings) { return res.status(400).json({ status: "failure", message: "No setting found" })}
      if (!foundUser) { return res.status(404).json({ status: "failure", message: "No user found" })}
      if( transactionData.receiver_id !== undefined){
        foundReceiverUser = await this.transactionService.getReceiverById(transactionData);
        if (!foundReceiverUser) { return res.status(404).json({ status: "failure", message: "No receiver user found" })}
        if (foundUser.id === foundReceiverUser.id && transactionData.transfer_type === "user_transfer") { return res.status(400).json({ status: "failure", message: "Same receiver user" })}
      }
      if (!foundUser.status && transactionData.type === "mobile") { return res.status(400).json({ status: "failure", message: "User not active" })}
      if (!foundUser.transfer && transactionData.transfer_type === "user_transfer" ) { return res.status(400).json({ status: "failure", message: "User not allow to transaction" })}

      // const regToken = foundUser.fcm;

      // const message = {
      //   notification: {
      //     title: "Transaction",
      //     body: "Deposit request initiated"
      //   },
      //   token: regToken
      // };

      // Handle type-specific validations
      const validationError = this.transactionService.validateTransaction(transactionData, foundUser, globalSettings);
      if (validationError) {
        return res.status(400).json(validationError);
      }

      // Create new transaction object
      const newTransaction = await this.transactionService.createTransactionObject(transactionData);
      
      
      // Handle file upload if applicable
      await this.transactionService.handleFileUpload(req, transactionData, newTransaction);
      

      // Set transaction details based on type
      this.transactionService.setTransactionDetails(transactionData, newTransaction, foundUser, foundAdmin, foundReceiverUser);

      // Send message using Firebase
      // await firebase.messaging().send(message);

      // Save transaction and update user
      await this.transactionService.saveTransaction(newTransaction, foundUser, foundAdmin, foundReceiverUser);

      // Commit transaction
      await this.databaseService.commitTransaction(session);

      if (transactionData.status === "failure") {
        return res.status(400).json({ status: 'success', message: "Transaction Failed" });
      }

      return res.status(200).json({ status: 'success', message: "Request created successfully" });
    } catch (err) {
      next(err);
      if (session) {
        await this.databaseService.abortTransaction(session);
      }
    } finally {
      if (session) {
        await this.databaseService.endSession(session);
      }
    }
  };

  public switchStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transactionData: SwitchTransactionDto = req.body;

      await this.transactionService.switchStatus(transactionData, req);

      res.status(200).json({ status: "success", message: "Status update successful" });
    } catch (err) {
      next(err);
    }
  };

  public getAllTransactions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queryDto: GetAllTransactionDto = req.query;
      const result = await this.transactionService.getAllTransactions(queryDto);
      res.status(200).json({ status: 'success', ...result });
    } catch (error) {
      next(error);
    }
  };

  public geUserTransactions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queryDto: GetUserTransactionDto = req.query;
      const result = await this.transactionService.geUserTransactions(queryDto);
      res.status(200).json({ status: 'success', ...result });
    } catch (error) {
      next(error);
    }
  };

  public createTransactionAgent = async(req: Request, res: Response, next: NextFunction) => {

    let session = null;

    try {
      session = await this.databaseService.startSession();
      session.startTransaction();

      const transactionDataAgent: CreateTransactionAgentDto = req.body;

      const globalSettings = await this.transactionService.getGlobalSettings();

      const foundAgent = await this.transactionService.getAgentById(transactionDataAgent);

      if (!globalSettings) { return res.status(400).json({ status: "failure", message: "No setting found" })}
      if (!foundAgent) { return res.status(404).json({ status: "failure", message: "No agent found" })}
      if (!foundAgent.status) { return res.status(400).json({ status: "failure", message: "Agent not active" })}
      if (!foundAgent.transfer) { return res.status(400).json({ status: "failure", message: "Agent not allow to transaction" })}

      // Handle type-specific validations
      const validationError = this.transactionService.validateTransactionAgent(transactionDataAgent, foundAgent, globalSettings);
      if (validationError) {
        return res.status(400).json(validationError);
      }

      // Create new transaction object
      const newTransaction = await this.transactionService.createTransactionObjectAgent(transactionDataAgent);
      
      
      // Handle file upload if applicable
      await this.transactionService.handleFileUpload(req, transactionDataAgent, newTransaction);
      

      // Set transaction details based on type
      this.transactionService.setTransactionDetailsAgent(transactionDataAgent, newTransaction, foundAgent);

      // Save transaction and update user
      await this.transactionService.saveTransactionAgent(newTransaction, foundAgent);

      // Commit transaction
      await this.databaseService.commitTransaction(session);

      if (transactionDataAgent.status === "failure") {
        return res.status(400).json({ status: 'success', message: "Transaction Failed" });
      }

      return res.status(200).json({ status: 'success', message: "Request created successfully" });
    } catch (err) {
      next(err);
      if (session) {
        await this.databaseService.abortTransaction(session);
      }
    } finally {
      if (session) {
        await this.databaseService.endSession(session);
      }
    }
  };
}

export default TransactionController;