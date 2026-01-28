import { ChangePassUserDto, ChangePasswordUserDto, ChangePinUserDto, CreateClientDto, ToggleUserDto, ToggleUserNotiDto, UpdateUserAllMatchLockDto, UpdateUserDto, UpdateUserMatchLockDto, UpdateUserRateDiffDto, UpdateUserStackDto } from '@dtos/users.dto';
import { HttpException } from '@exceptions/HttpException';
import UserModel from '@models/user.model';
import { GetAllUserQuery, User, UserRespond } from '@interfaces/users.interface';
import { comparePassword, encrypt, isEmpty } from '@utils/util';
// import { logger } from '@/utils/logger';
import path from 'path';
import { ObjectId } from 'mongodb';
import { promises as fsPromises } from 'fs';
import TransactionModel from '@/models/transaction.model';
import BetModel from '@/models/bet.model';
import { Admin } from '@/interfaces/admin.interface';
import AdminModel from '@/models/admin.model';
import MatchModel from '@/models/match.model';
import { UpdateLimitDto } from '@/dtos/admin.dto';
import WalletHistoryModel from '@/models/walletHistory.model';

class UserService {
  public users = UserModel;
  public admin = AdminModel;
  public match = MatchModel;
  public transaction = TransactionModel;
  public bet = BetModel;
  public walletHistory = WalletHistoryModel;
  // public enquiry = EnquiryModel;
  // public msg = MsgModel;
  // public notices = NoticesModel;

  public async createUser(userData: CreateClientDto, agent: Admin): Promise<User> {
    if (isEmpty(userData)) throw new HttpException(400, 'userData is empty');

    // const findUser = await this.users.findOne({ mobile: userData.mobile });
    // if (findUser) throw new HttpException(409, `This Mobile Number ${userData.mobile} already exists`);

    const hashedPassword = await encrypt(userData.password, 10);

    if (agent.type === "agent") {
      const newUser = await this.users.create({
        ...userData,
        agent_id: agent.id,
        verified: true,
        password: hashedPassword,
      });

      await this.admin.findByIdAndUpdate(  // Update agent wallet and exposure
        agent.id,
        {
          $push: { sub_admin_list: newUser.id },
          $inc: {
            wallet: -userData.wallet,
            exposure: userData.wallet
          }
        }, { new: true });

        //Update Wallet History
        await this.walletHistory.create({
          user_id: agent.id,
          receiver_id: newUser.id,
          agent_id: agent.id,
          amount: userData.wallet,
          user_type: 'User',
          type: 'Credit',
          description: `${newUser.user_name} get ${userData.wallet} from wallet for SignUp From ${agent.user_name}`,
          status: 'success',
        });

      return newUser;
    } else {
      throw new HttpException(400, 'Invalid agent type');
    }
  }

  public async updateUser(userData: UpdateUserDto): Promise<User> {
    if (isEmpty(userData)) throw new HttpException(400, 'userData is empty');

    const findUser: User = await this.users.findById(userData.id);
    if (!findUser) throw new HttpException(409, "User doesn't exist");

    // Clean up undefined fields from userData
    const cleanedUserData = Object.keys(userData).reduce((acc, key) => {
      if (userData[key] !== undefined) {
        acc[key] = userData[key];
      }
      return acc;
    }, {} as UpdateUserDto);

    // Hash password if provided
    if (userData.password !== undefined) {
      cleanedUserData.password = await encrypt(userData.password, 10);
    }

    const updateUser: User = await this.users.findByIdAndUpdate(findUser.id, cleanedUserData, { new: true });
    return updateUser;
  }

  public async changeUserPassword(userData: ChangePasswordUserDto, userId: String): Promise<String> {

    const user = await this.users.findById(userId);

    if (isEmpty(user)) {
      throw new HttpException(400, "User Data is empty");
    }
    if (userData.old_password === userData.new_password) {
      throw new HttpException(409, "New password must be different from old password");
    }

    const isPasswordMatching = await comparePassword(userData.old_password, user.password, 10);
    if (!isPasswordMatching) {
      throw new HttpException(409, "Old password is incorrect");
    }
    if (userData.new_password) {
      user.password = await encrypt(userData.new_password, 10);
      await user.save();
    }
    return 'Password changed successfully';
  }

  private async deleteFileIfExist(directory: string, filename: string) {
    const imagePath = path.join(__dirname, `../public/${directory}/${filename}`);
    try {
      await fsPromises.access(imagePath);
      await fsPromises.unlink(imagePath);
    } catch (err) {
      console.error(`Error deleting file ${filename}:`, err);
    }
  }

  public async deleteUser(userId: string): Promise<void> {
    if (isEmpty(userId)) {
      throw new HttpException(400, 'User data is empty');
    }

    const foundItem = await this.users.findById(userId);
    if (!foundItem) {
      throw new HttpException(404, 'User not found');
    }

    // Fetch transactions associated with the user
    const transactionData = await this.transaction.find({ user_id: userId });

    // Deleting files in parallel using Promise.all to handle all deletions at once
    const fileDeletionPromises = transactionData.flatMap(transaction => [
      transaction.payment_proof ? this.deleteFileIfExist('transaction', transaction.payment_proof) : null,
      transaction.receipt ? this.deleteFileIfExist('receipt', transaction.receipt) : null,
    ].filter(Boolean)); // Filter out null values

    await Promise.all(fileDeletionPromises);

    // Delete user and related data simultaneously to minimize the time of operation
    await Promise.all([
      this.users.findByIdAndDelete(userId),
      this.transaction.deleteMany({ user_id: userId }),
      this.bet.deleteMany({ user_id: userId }),
    ]);
  }

  public async updateUserRateDiff(userData: UpdateUserRateDiffDto): Promise<String> {
    if (isEmpty(userData)) throw new HttpException(400, 'userData is empty');
    const findUser: User = await this.users.findById(userData.userId);
    if (!findUser) throw new HttpException(409, "User doesn't exist");
    await this.users.findByIdAndUpdate(findUser.id, { rate_diff: userData.rate_diff });
    return 'Rate diff updated successfully';
  }

  public async updateUserStack(userData: UpdateUserStackDto): Promise<String> {
    if (isEmpty(userData)) throw new HttpException(400, 'userData is empty');
    const findUser: User = await this.users.findById(userData.userId);
    if (!findUser) throw new HttpException(409, "User doesn't exist");
    await this.users.findByIdAndUpdate(findUser.id, { $push: { stack: userData.stack } });
    return 'Stack updated successfully';
  }

  public async deleteUserStack(userData: UpdateUserStackDto): Promise<String> {
    if (isEmpty(userData)) throw new HttpException(400, 'userData is empty');
    const findUser: User = await this.users.findById(userData.userId);
    if (!findUser) throw new HttpException(409, "User doesn't exist");
    await this.users.findByIdAndUpdate(findUser.id, { $pull: { stack: userData.stack } });
    return 'Stack deleted successfully';
  }

  public async getUserStack(userId: string): Promise<any> {
    if (isEmpty(userId)) throw new HttpException(400, 'userData is empty');
    const findUser: User = await this.users.findById(new ObjectId(userId));
    if (!findUser) throw new HttpException(409, "User doesn't exist");
    if (!findUser.stack) throw new HttpException(409, "Stack doesn't exist");
    return findUser.stack;
  }

  public async getAllUsers(userData: GetAllUserQuery): Promise<{ total: number, users: User[] }> {

    // Clone userData to avoid mutating the original object
    const query: GetAllUserQuery = { ...userData };

    // Set default values for skip and count, if not provided
    const skip: number = query.skip ? Number(query.skip) : 0;
    const count: number = query.count ? Number(query.count) : undefined;

    // Clean up undefined fields from the query
    for (const key in query) {
      if (query[key] === undefined) {
        delete query[key];
      }
    }

    // Fetch the total number of users that match the query
    const total = await this.users.countDocuments(query);

    // Set the limit for pagination
    const limit = count !== undefined ? Number(count) : total;

    // Fetch the user list with skip, limit, and sorting, excluding mpin and __v
    const userList: User[] = await this.users
      .find(query)
      .populate('agent_id', 'name mobile wallet')
      .select('-mpin -__v')
      .skip(skip * limit)  // Correct pagination calculation
      .limit(limit)
      .sort({ createdAt: -1 });

    return { total, users: userList };
  }

  /**
   * Get all users under the logged-in admin with pagination
   */
  public async getUsersUnderAdmin(
    loggedInAdmin: Admin,
    queryParams: GetAllUserQuery = {}
  ): Promise<{ total: number; users: User[] }> {
    // Extract pagination params
    const skipValue: number = queryParams.skip ? Number(queryParams.skip) : 0;
    const countValue: number = queryParams.count ? Number(queryParams.count) : undefined;

    // Remove skip/count from query (don't pass them to Mongo)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { skip, count, ...rest } = queryParams;
    const query: Record<string, any> = { ...rest };

    // 🔑 Restrict to users under this admin’s hierarchy
    const allAgents = await this.getAllAgentsUnder(loggedInAdmin._id.toString());

    // If logged in admin itself is an agent → only his users
    if (loggedInAdmin.type === 'agent') {
      query.agent_id = loggedInAdmin._id;
    } else {
      query.agent_id = { $in: allAgents };
    }

    // Total matching users
    const total = await this.users.countDocuments(query);

    // Limit for pagination (default = total)
    const limit = countValue !== undefined ? Number(countValue) : total;

    // Fetch users with pagination
    const users: User[] = await this.users.find(query)
      .populate('agent_id', 'name mobile wallet')
      .select('-mpin -__v')
      .skip(skipValue * limit) // page offset
      .limit(limit)
      .sort({ createdAt: -1 });

    return { total, users };
  }

  /**
   * Recursively fetch all agent IDs under an admin
   */
  private async getAllAgentsUnder(adminId: string): Promise<string[]> {
    const agents: string[] = [];

    const recurse = async (parentId: string) => {
      const children = await this.admin.find({ parent_id: parentId })
        .select('_id type')
        .lean();

      for (const child of children) {
        if (child.type === 'agent') {
          agents.push(child._id.toString());
        }
        await recurse(child._id.toString());
      }
    };

    await recurse(adminId);
    return agents;
  }

  /**
   * Get all user IDs under an admin (including all sub-admins)
   */
  private async getAllUsersUnderAdmin(adminId: string): Promise<string[]> {
    const allAgents = await this.getAllAgentsUnder(adminId);

    // If the admin itself is an agent, include it
    const admin = await this.admin.findById(adminId).select('type');
    if (admin && admin.type === 'agent') {
      allAgents.push(adminId);
    }

    // Get all users under these agents
    const users = await this.users.find({ agent_id: { $in: allAgents } }).select('_id');
    return users.map(user => user._id.toString());
  }

  /**
   * Check if an admin has permission to toggle a match lock
   * Only the admin who locked it or their parents can unlock it
   */
  private async checkBmLockPermission(adminId: string, matchId: string): Promise<boolean> {
    const match = await this.match.findById(matchId).select('bm_lock');
    if (!match) return false;

    // If no one has locked this match, anyone can lock it
    if (match.bm_lock.length === 0) return true;

    // Check if the current admin is one of the admins who locked this match
    if (match.bm_lock.includes(adminId)) return true;

    // Check if any of the current admin's parents locked this match
    const parentAdmins = await this.getAllParentAdmins(adminId);
    const hasParentLock = match.bm_lock.some(lockedAdminId =>
      parentAdmins.some(parentId => parentId.toString() === lockedAdminId.toString())
    );

    return hasParentLock;
  }

  /**
   * Get all parent admins up the hierarchy
   */
  private async getAllParentAdmins(adminId: string): Promise<string[]> {
    const parents: string[] = [];

    const recurse = async (currentId: string) => {
      const admin = await this.admin.findById(currentId).select('parent_id');
      if (admin && admin.parent_id) {
        parents.push(admin.parent_id.toString());
        await recurse(admin.parent_id.toString());
      }
    };

    await recurse(adminId);
    return parents;
  }

  /**
   * Check if an admin has permission to toggle a fancy match lock
   * Only the admin who locked it or their parents can unlock it
   */
  private async checkFancyLockPermission(adminId: string, matchId: string): Promise<boolean> {
    const match = await this.match.findById(matchId).select('fancy_lock');
    if (!match) return false;

    // If no one has locked this match, anyone can lock it
    if (match.fancy_lock.length === 0) return true;

    // Check if the current admin is one of the admins who locked this match
    if (match.fancy_lock.includes(adminId)) return true;

    // Check if any of the current admin's parents locked this match
    const parentAdmins = await this.getAllParentAdmins(adminId);
    const hasParentLock = match.fancy_lock.some(lockedAdminId =>
      parentAdmins.some(parentId => parentId.toString() === lockedAdminId.toString())
    );

    return hasParentLock;
  }

  public async getAllUsersApp(userData: GetAllUserQuery): Promise<{ total: number, users: User[] }> {

    // Clone userData to avoid mutating the original object
    const query: GetAllUserQuery = { ...userData };

    // Set default values for skip and count, if not provided
    const skip: number = query.skip ? Number(query.skip) : 0;
    const count: number = query.count ? Number(query.count) : undefined;

    // Clean up undefined fields from the query
    for (const key in query) {
      if (query[key] === undefined) {
        delete query[key];
      }
    }

    // Fetch the total number of users that match the query
    const total = await this.users.countDocuments(query);

    // Set the limit for pagination
    const limit = count !== undefined ? Number(count) : total;


    // Fetch the user list with skip, limit, and sorting, excluding mpin and __v
    const userList: User[] = await this.users
      .find(query)
      .select('-mpin -__v -mpin -password')
      .skip(skip * limit)  // Correct pagination calculation
      .limit(limit)
      .sort({ createdAt: -1 });

    return { total, users: userList };
  }

  public async changePassword(ChangePasswordData: ChangePassUserDto): Promise<UserRespond> {
    if (isEmpty(ChangePasswordData)) throw new HttpException(400, 'User Data is empty');

    const { mobile, old_password, password } = ChangePasswordData;

    if (!mobile || !old_password || !password) {
      throw new HttpException(400, "Mobile, old MPIN, and new MPIN are required.");
    }

    const foundUser = await this.users.findOne({ mobile }).select("password");
    if (!foundUser) {
      throw new HttpException(400, "User not found for mobile");
    }
    const isPasswordMatching: boolean = await comparePassword(old_password, foundUser.password, 10);
    if (!isPasswordMatching) throw new HttpException(409, 'Password not matching');

    const hashedPassword = await encrypt(password, 10);
    foundUser.password = hashedPassword;
    await foundUser.save();

    return foundUser;
  }

  public async changePin(ChangePinData: ChangePinUserDto): Promise<UserRespond> {
    if (isEmpty(ChangePinData)) throw new HttpException(400, 'User Data is empty');

    const { mobile, old_mpin, mpin } = ChangePinData;

    if (!mobile || !old_mpin || !mpin) {
      throw new HttpException(400, "Mobile, old MPIN, and new MPIN are required.");
    }

    const foundUser = await this.users.findOne({ mobile }).select("mpin");
    if (!foundUser) {
      throw new HttpException(400, "User not found for mobile");
    }
    const isPasswordMatching: boolean = await comparePassword(old_mpin, foundUser.mpin, 10);
    if (!isPasswordMatching) throw new HttpException(409, 'Password not matching');

    const hashedMpin = await encrypt(mpin, 10);
    foundUser.mpin = hashedMpin;
    await foundUser.save();

    return foundUser;
  }

  public async findUserById(userId: string): Promise<User> {
    if (isEmpty(userId)) throw new HttpException(400, 'User Data is empty');
    const foundUser = await this.users.findById({ _id: userId }).select('-__v');;
    if (!foundUser) {
      throw new HttpException(400, "User not found for Id");
    }
    return foundUser
  }

  public async toggleUser(userToggleData: ToggleUserDto): Promise<User> {
    if (isEmpty(userToggleData)) throw new HttpException(400, 'User Data is empty');

    const { id, toggle } = userToggleData;
    const foundUser = await this.users.findById(id);
    if (!foundUser) throw new HttpException(400, "No user found for the id");

    const toggleMap = {
      "status": "status",
      "betting": "betting",
      "transfer": "transfer"
    };

    if (!toggleMap.hasOwnProperty(toggle)) {
      throw new HttpException(400, "Invalid toggle value");
    }

    foundUser[toggleMap[toggle]] = !foundUser[toggleMap[toggle]];
    await foundUser.save();

    return foundUser;
  }

  public async updateUserMatchBmLock(userData: UpdateUserMatchLockDto): Promise<{ message: string }> {
    if (isEmpty(userData)) throw new HttpException(400, 'User Data is empty');

    const { adminId, matchId } = userData;

    const foundMatch = await this.match.findById(matchId);
    if (!foundMatch) throw new HttpException(400, "No match found for the id");

    const foundAdmin = await this.admin.findById(adminId);
    if (!foundAdmin) throw new HttpException(400, "No admin found for the id");

    // Check if the current admin has permission to toggle this match
    const hasPermission = await this.checkBmLockPermission(adminId, matchId);
    if (!hasPermission) {
      throw new HttpException(403, "You don't have permission to toggle this match lock");
    }

    // Check if the match is already locked by this admin
    const isAlreadyLocked = foundAdmin.bm_lock.includes(matchId);
    const isMatchLockedByAdmin = foundMatch.bm_lock.includes(adminId);

    if (isAlreadyLocked && isMatchLockedByAdmin) {
      // Unlock: Remove from both admin and match
      foundAdmin.bm_lock = foundAdmin.bm_lock.filter(id => id.toString() !== matchId);
      foundMatch.bm_lock = foundMatch.bm_lock.filter(id => id.toString() !== adminId);

      // Get all users under this admin and remove matchId from their bm_lock
      const usersUnderAdmin = await this.getAllUsersUnderAdmin(adminId);
      await this.users.updateMany(
        { _id: { $in: usersUnderAdmin } },
        { $pull: { bm_lock: matchId } }
      );

      await Promise.all([foundAdmin.save(), foundMatch.save()]);
      return { message: "Bookmaker unlocked successfully" };
    } else if (!isAlreadyLocked && !isMatchLockedByAdmin) {
      // Lock: Add to both admin and match
      foundAdmin.bm_lock.push(matchId);
      foundMatch.bm_lock.push(adminId);

      // Get all users under this admin and add matchId to their bm_lock
      const usersUnderAdmin = await this.getAllUsersUnderAdmin(adminId);
      await this.users.updateMany(
        { _id: { $in: usersUnderAdmin } },
        { $addToSet: { bm_lock: matchId } }
      );

      await Promise.all([foundAdmin.save(), foundMatch.save()]);
      return { message: "Bookmaker locked successfully" };
    } else {
      throw new HttpException(400, "Match lock state is inconsistent. Please contact support.");
    }
  }

  public async updateUserAllMatchBmLock(userData: UpdateUserAllMatchLockDto): Promise<{ message: string }> {
    if (isEmpty(userData)) throw new HttpException(400, 'User Data is empty');

    const { adminId, matchId } = userData;

    const foundAdmin = await this.admin.findById(adminId);
    if (!foundAdmin) throw new HttpException(400, "No admin found for the id");

    // Get all users under this admin
    const usersUnderAdmin = await this.getAllUsersUnderAdmin(adminId);

    if (matchId) {
      // If specific matchId is provided, handle single match
      const foundMatch = await this.match.findById(matchId);
      if (!foundMatch) throw new HttpException(400, "No match found for the id");

      // Check if the current admin has permission to toggle this match
      const hasPermission = await this.checkBmLockPermission(adminId, matchId);
      if (!hasPermission) {
        throw new HttpException(403, "You don't have permission to toggle this match lock");
      }

      // Check if the match is already locked by this admin
      const isAlreadyLocked = foundAdmin.bm_lock.includes(matchId);
      const isMatchLockedByAdmin = foundMatch.bm_lock.includes(adminId);

      if (isAlreadyLocked && isMatchLockedByAdmin) {
        // Unlock: Remove from both admin and match
        foundAdmin.bm_lock = foundAdmin.bm_lock.filter(id => id.toString() !== matchId);
        foundMatch.bm_lock = foundMatch.bm_lock.filter(id => id.toString() !== adminId);

        // Remove matchId from all users under this admin
        await this.users.updateMany(
          { _id: { $in: usersUnderAdmin } },
          { $pull: { bm_lock: matchId } }
        );

        await Promise.all([foundAdmin.save(), foundMatch.save()]);
        return { message: "Bookmaker unlocked successfully for match" };
      } else if (!isAlreadyLocked && !isMatchLockedByAdmin) {
        // Lock: Add to both admin and match
        foundAdmin.bm_lock.push(matchId);
        foundMatch.bm_lock.push(adminId);

        // Add matchId to all users under this admin
        await this.users.updateMany(
          { _id: { $in: usersUnderAdmin } },
          { $addToSet: { bm_lock: matchId } }
        );

        await Promise.all([foundAdmin.save(), foundMatch.save()]);
        return { message: "Bookmaker locked successfully for match" };
      } else {
        throw new HttpException(400, "Match lock state is inconsistent. Please contact support.");
      }
    } else {
      // If no matchId provided, handle all matches
      // Get all active matches
      const allMatches = await this.match.find({ status: true }).select('_id bm_lock');

      // Check if admin has any locked matches
      const hasLockedMatches = foundAdmin.bm_lock.length > 0;

      if (hasLockedMatches) {
        // Unlock all matches
        const matchIds = foundAdmin.bm_lock;

        // Remove admin from all matches
        await this.match.updateMany(
          { _id: { $in: matchIds } },
          { $pull: { bm_lock: adminId } }
        );

        // Clear admin's bm_lock
        foundAdmin.bm_lock = [];
        foundAdmin.bm_lock_status = true;
        await foundAdmin.save();

        // Remove all match IDs from all users under this admin
        await this.users.updateMany(
          { _id: { $in: usersUnderAdmin } },
          { $pull: { bm_lock: { $in: matchIds } } }
        );

        return { message: `Bookmaker unlocked successfully for ${matchIds.length} matches` };
      } else {
        // Lock all active matches
        const matchIds = allMatches.map(match => match._id.toString());

        // Add admin to all matches
        await this.match.updateMany(
          { _id: { $in: matchIds } },
          { $addToSet: { bm_lock: adminId } }
        );

        // Add all match IDs to admin's bm_lock
        foundAdmin.bm_lock = matchIds;
        foundAdmin.bm_lock_status = false;
        await foundAdmin.save();

        // Add all match IDs to all users under this admin
        await this.users.updateMany(
          { _id: { $in: usersUnderAdmin } },
          { $addToSet: { bm_lock: { $each: matchIds } } }
        );

        return { message: `Bookmaker locked successfully for ${matchIds.length} matches` };
      }
    }
  }

  public async updateUserMatchFancyLock(userData: UpdateUserMatchLockDto): Promise<{ message: string }> {
    if (isEmpty(userData)) throw new HttpException(400, 'User Data is empty');

    const { adminId, matchId } = userData;

    const foundMatch = await this.match.findById(matchId);
    if (!foundMatch) throw new HttpException(400, "No match found for the id");

    const foundAdmin = await this.admin.findById(adminId);
    if (!foundAdmin) throw new HttpException(400, "No admin found for the id");

    // Check if the current admin has permission to toggle this match
    const hasPermission = await this.checkFancyLockPermission(adminId, matchId);
    if (!hasPermission) {
      throw new HttpException(403, "You don't have permission to toggle this match lock");
    }

    // Check if the match is already locked by this admin
    const isAlreadyLocked = foundAdmin.fancy_lock.includes(matchId);
    const isMatchLockedByAdmin = foundMatch.fancy_lock.includes(adminId);

    if (isAlreadyLocked && isMatchLockedByAdmin) {
      // Unlock: Remove from both admin and match
      foundAdmin.fancy_lock = foundAdmin.fancy_lock.filter(id => id.toString() !== matchId);
      foundMatch.fancy_lock = foundMatch.fancy_lock.filter(id => id.toString() !== adminId);

      // Get all users under this admin and remove matchId from their fancy_lock
      const usersUnderAdmin = await this.getAllUsersUnderAdmin(adminId);
      await this.users.updateMany(
        { _id: { $in: usersUnderAdmin } },
        { $pull: { fancy_lock: matchId } }
      );

      await Promise.all([foundAdmin.save(), foundMatch.save()]);
      return { message: "Fancy unlocked successfully" };
    } else if (!isAlreadyLocked && !isMatchLockedByAdmin) {
      // Lock: Add to both admin and match
      foundAdmin.fancy_lock.push(matchId);
      foundMatch.fancy_lock.push(adminId);

      // Get all users under this admin and add matchId to their fancy_lock
      const usersUnderAdmin = await this.getAllUsersUnderAdmin(adminId);
      await this.users.updateMany(
        { _id: { $in: usersUnderAdmin } },
        { $addToSet: { fancy_lock: matchId } }
      );

      await Promise.all([foundAdmin.save(), foundMatch.save()]);
      return { message: "Fancy locked successfully" };
    } else {
      throw new HttpException(400, "Match lock state is inconsistent. Please contact support.");
    }
  }

  public async updateUserAllMatchFancyLock(userData: UpdateUserAllMatchLockDto): Promise<{ message: string }> {
    if (isEmpty(userData)) throw new HttpException(400, 'User Data is empty');

    const { adminId, matchId } = userData;

    const foundAdmin = await this.admin.findById(adminId);
    if (!foundAdmin) throw new HttpException(400, "No admin found for the id");

    // Get all users under this admin
    const usersUnderAdmin = await this.getAllUsersUnderAdmin(adminId);

    if (matchId) {
      // If specific matchId is provided, handle single match
      const foundMatch = await this.match.findById(matchId);
      if (!foundMatch) throw new HttpException(400, "No match found for the id");

      // Check if the current admin has permission to toggle this match
      const hasPermission = await this.checkFancyLockPermission(adminId, matchId);
      if (!hasPermission) {
        throw new HttpException(403, "You don't have permission to toggle this match lock");
      }

      // Check if the match is already locked by this admin
      const isAlreadyLocked = foundAdmin.fancy_lock.includes(matchId);
      const isMatchLockedByAdmin = foundMatch.fancy_lock.includes(adminId);

      if (isAlreadyLocked && isMatchLockedByAdmin) {
        // Unlock: Remove from both admin and match
        foundAdmin.fancy_lock = foundAdmin.fancy_lock.filter(id => id.toString() !== matchId);
        foundMatch.fancy_lock = foundMatch.fancy_lock.filter(id => id.toString() !== adminId);

        // Remove matchId from all users under this admin
        await this.users.updateMany(
          { _id: { $in: usersUnderAdmin } },
          { $pull: { fancy_lock: matchId } }
        );

        await Promise.all([foundAdmin.save(), foundMatch.save()]);
        return { message: "Fancy unlocked successfully for match" };
      } else if (!isAlreadyLocked && !isMatchLockedByAdmin) {
        // Lock: Add to both admin and match
        foundAdmin.fancy_lock.push(matchId);
        foundMatch.fancy_lock.push(adminId);

        // Add matchId to all users under this admin
        await this.users.updateMany(
          { _id: { $in: usersUnderAdmin } },
          { $addToSet: { fancy_lock: matchId } }
        );

        await Promise.all([foundAdmin.save(), foundMatch.save()]);
        return { message: "Fancy locked successfully for match" };
      } else {
        throw new HttpException(400, "Match lock state is inconsistent. Please contact support.");
      }
    } else {
      // If no matchId provided, handle all matches
      // Get all active matches
      const allMatches = await this.match.find({ status: true }).select('_id fancy_lock');

      // Check if admin has any locked matches
      const hasLockedMatches = foundAdmin.fancy_lock.length > 0;

      if (hasLockedMatches) {
        // Unlock all matches
        const matchIds = foundAdmin.fancy_lock;

        // Remove admin from all matches
        await this.match.updateMany(
          { _id: { $in: matchIds } },
          { $pull: { fancy_lock: adminId } }
        );

        // Clear admin's fancy_lock
        foundAdmin.fancy_lock = [];
        foundAdmin.fancy_lock_status = true;
        await foundAdmin.save();

        // Remove all match IDs from all users under this admin
        await this.users.updateMany(
          { _id: { $in: usersUnderAdmin } },
          { $pull: { fancy_lock: { $in: matchIds } } }
        );

        return { message: `Fancy unlocked successfully for ${matchIds.length} matches` };
      } else {
        // Lock all active matches
        const matchIds = allMatches.map(match => match._id.toString());

        // Add admin to all matches
        await this.match.updateMany(
          { _id: { $in: matchIds } },
          { $addToSet: { fancy_lock: adminId } }
        );

        // Add all match IDs to admin's fancy_lock
        foundAdmin.fancy_lock = matchIds;
        foundAdmin.fancy_lock_status = false;
        await foundAdmin.save();

        // Add all match IDs to all users under this admin
        await this.users.updateMany(
          { _id: { $in: usersUnderAdmin } },
          { $addToSet: { fancy_lock: { $each: matchIds } } }
        );

        return { message: `Fancy locked successfully for ${matchIds.length} matches` };
      }
    }
  }

  public async updateUserLimit(userData: UpdateLimitDto): Promise<User> {
    if (isEmpty(userData)) throw new HttpException(400, 'LimitData is empty');

    const findUser: User | null = await this.users.findById(userData.id).select('agent_id');
    if (!findUser) throw new HttpException(409, "User doesn't exist");

    const parentAdmin: Admin | null = await this.admin.findById(findUser.agent_id);
    if (!parentAdmin) throw new HttpException(409, "Parent admin doesn't exist");

    const amount = userData.limit;

    if (userData.type === "deposit") {
      // Check balance first
      if (parentAdmin.wallet < amount) {
        throw new HttpException(400, "Parent does not have enough balance");
      }

      await this.admin.findByIdAndUpdate(parentAdmin._id, { $inc: { wallet: -amount } });
      await this.users.findByIdAndUpdate(findUser._id, { $inc: { wallet: amount } });

      await this.walletHistory.create({
        user_id: parentAdmin._id,
        amount: amount,
        receiver_id: findUser._id,
        note: `Limit deposit to ${findUser.name}`,
        type: "Credit",
        status: "success",
        user_type: "User"
      });

    } else if (userData.type === "withdrawal") {
      if (findUser.wallet < amount) {
        throw new HttpException(400, "Admin does not have enough balance");
      }

      await this.users.findByIdAndUpdate(findUser._id, { $inc: { wallet: -amount } });
      await this.admin.findByIdAndUpdate(parentAdmin._id, { $inc: { wallet: amount } });

      await this.walletHistory.create({
        user_id: parentAdmin._id,
        amount: amount,
        receiver_id: findUser._id,
        note: `Limit withdrawal to ${parentAdmin.name}`,
        type: "Debit",
        status: "success",
        user_type: "User"
      });

    } else {
      throw new HttpException(400, "Invalid limit type");
    }

    // Return updated child admin
    const updateUser: User = await this.users.findById(findUser._id).lean();
    return updateUser;
  }

  public async toggleUserNotification(userToggleData: ToggleUserNotiDto): Promise<User> {
    if (isEmpty(userToggleData)) throw new HttpException(400, 'User Data is empty');

    const { id, toggle } = userToggleData;
    const foundUser = await this.users.findById(id);
    if (!foundUser) throw new HttpException(400, "No user found for the id");

    const toggleMap = {
      "galidisawar_notification": "galidisawar_notification",
      "starline_notification": "starline_notification",
      "main_notification": "main_notification"
    };

    const toggleKey = `${toggle}_notification`;

    if (!toggleMap.hasOwnProperty(toggleKey)) {
      throw new HttpException(400, "Invalid toggle value");
    }
    foundUser[toggleMap[toggleKey]] = !foundUser[toggleMap[toggleKey]];
    await foundUser.save();

    return foundUser;
  }

  public async getRandomUniqueArray(length: number, sourceArray: any[]): Promise<any[]> {
    if (length > new Set(sourceArray).size) {
      throw new HttpException(400, "Source array does not contain enough unique elements to satisfy the requested length.");
    }
    length = length ? Number(length) : 10;
    const uniqueElements = new Set();
    const resultArray = [];

    while (uniqueElements.size < length) {
      const randomIndex = Math.floor(Math.random() * sourceArray.length);
      const element = sourceArray[randomIndex];
      if (!uniqueElements.has(element)) {
        uniqueElements.add(element);
        resultArray.push(element);
      }
    }
    return resultArray;
  }

}

export default UserService;
