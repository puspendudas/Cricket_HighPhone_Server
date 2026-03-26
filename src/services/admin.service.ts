import { sign } from 'jsonwebtoken';
// External Dependencies
import { ObjectId } from 'mongodb';
import { ADMIN_SECRET_KEY, AGENT_SECRET_KEY } from '@/config';
import cron from 'node-cron';
import { HttpException } from '@exceptions/HttpException';
import { DataStoredInToken, TokenData } from '@interfaces/auth.interface';
import { comparePassword, convertFromTo, encrypt, isEmpty } from '@utils/util';
import AdminModel from '@/models/admin.model';
import { Admin, AdminRespond } from '@/interfaces/admin.interface';
import {
  AdminChangeMobileDto,
  AdminChangePasswordDto,
  UpdateAdminDto,
  AgentChangePasswordDto,
  CreateAdminDto,
  GetAgentDto,
  GetAllAdminDto,
  MobileLoginAdminDto,
  ToggleAdminDto,
  UpdateAgentDto,
  UpdateByAgentDto,
  UpdateLimitDto,
  ToggleAllAdminDto
} from '@/dtos/admin.dto';
import SettingModel from '@/models/setting.model';
import MarketModel from '@/models/market.model';
import path from 'path';
import { promises as fs } from 'fs';
import TransactionModel from '@/models/transaction.model';
import { logger } from '@/utils/logger';
import UserModel from '@/models/user.model';
import WalletHistoryModel from '@/models/walletHistory.model';

class AdminService {
  public admin = AdminModel;
  public user = UserModel;
  public settings = SettingModel;
  public markets = MarketModel;
  public transaction = TransactionModel;
  public walletHistory = WalletHistoryModel;
  private cronJob: cron.ScheduledTask | null = null;
  private cronTestJob: cron.ScheduledTask | null = null;
  private jobTime = '0 5 * * *'; // Default to 05:00

  // keep hierarchy private inside the class
  private readonly ROLE_HIERARCHY = [
    "super_admin",
    "admin",
    "super_master",
    "master",
    "super_agent",
    "agent",
    "user"
  ];

  public async signup(adminData: CreateAdminDto, parent: Admin): Promise<Admin> {
    if (isEmpty(adminData)) {
      logger.warn("[Signup] Empty adminData received");
      throw new HttpException(400, "userData is empty");
    }

    logger.info(`[Signup] Attempting to create new admin with mobile: ${adminData.mobile}, role: ${adminData.type}, under parent: ${parent.type} (${parent._id})`);

    const hashedPassword = await encrypt(adminData.password, 10);

    // Define valid parent-child relationships
    const validHierarchy = {
      admin: "super_admin",
      super_master: "admin",
      master: "super_master",
      super_agent: "master",
      agent: "super_agent",
    };

    // ✅ Check hierarchy first
    if (validHierarchy[adminData.type] === parent.type) {
      logger.debug(`[Signup] Valid parent-child relationship: ${parent.type} → ${adminData.type}`);

      // ✅ Share check (if share is provided)
      if (adminData.share !== undefined) {
        logger.debug(`[Signup] Checking share: child=${adminData.share}, parent=${parent.share}`);
        if (adminData.share > parent.share) {
          logger.error(`[Signup] Share validation failed. Child share (${adminData.share}) > Parent share (${parent.share})`);
          throw new HttpException(
            400,
            `Share (${adminData.share}) cannot be higher than parent's share (${parent.share})`
          );
        }
      }

      const session = await this.admin.db.startSession();
      try {
        session.startTransaction();
        logger.info("[Signup] Transaction started");

        // Create new admin
        const createAdminData: Admin[] = await this.admin.create(
          [
            {
              ...adminData,
              password: hashedPassword,
              agent_code: adminData.mobile,
              parent_id: parent.id,
            },
          ],
          { session }
        );

        logger.info(`[Signup] New admin created successfully: ${createAdminData[0]._id}, type=${createAdminData[0].type}`);

        // Prepare update query for parent
        const updateQuery: any = {
          $push: { sub_admin_list: createAdminData[0].id },
          $inc: {
            wallet: -adminData.wallet,
            exposure: adminData.wallet,
          },
        };

        logger.debug(`[Signup] Updating parent: ${parent._id}, Wallet -${adminData.wallet}, Exposure +${adminData.wallet}`);

        // Update parent
        const updateResult = await this.admin.updateOne(
          { _id: parent.id },
          updateQuery,
          { session }
        );

        if (updateResult.modifiedCount === 0) {
          logger.error(`[Signup] Parent update failed for parentId=${parent._id}`);
          throw new HttpException(400, "Parent not found or update failed");
        }

        logger.info(`[Signup] Parent updated successfully: ${parent._id}`);

        await session.commitTransaction();
        logger.info(`[Signup] Transaction committed successfully for new admin: ${createAdminData[0]._id}`);


        //Update Wallet History
        await this.walletHistory.create({
          user_id: createAdminData[0].id,
          receiver_id: parent.id,
          agent_id: parent.id,
          amount: -adminData.wallet,
          user_type: 'Admin',
          type: 'Debit',
          description: `${createAdminData[0].user_name} take ${adminData.wallet} from wallet for SignUp`,
          status: 'success',
        });

        //Update Wallet History
        await this.walletHistory.create({
          user_id: parent.id,
          agent_id: createAdminData[0].id,
          amount: adminData.wallet,
          user_type: 'Admin',
          type: 'Credit',
          description: `${createAdminData[0].user_name} get ${adminData.wallet} from wallet for SignUp`,
          status: 'success',
        });

        return createAdminData[0];
      } catch (error) {
        await session.abortTransaction();
        logger.error(`[Signup] Transaction aborted. Error: ${error.message}`, { stack: error.stack });
        throw error;
      } finally {
        session.endSession();
        logger.debug("[Signup] Session ended");
      }
    } else {
      logger.error(`[Signup] Invalid parent-child relationship. Parent=${parent.type}, Child=${adminData.type}`);
      throw new HttpException(400, "Invalid parent type");
    }
  }

  public async findAdminById(id: string): Promise<Admin> {
    const admin = await this.admin.findById(id);
    if (!admin) throw new HttpException(404, 'Admin not found');
    return admin;
  }

  public async updateAdmin(adminData: UpdateAdminDto): Promise<Admin> {
    if (isEmpty(adminData)) throw new HttpException(400, 'AgentData is empty');

    // Fetch current admin, including parent and sub_admin_list
    const findAdmin: Admin = await this.admin
      .findById(adminData.id)
      .select('+parent_id +share')
      .populate({
        path: 'sub_admin_list',
        select: 'user_name share',
      });

    if (!findAdmin) throw new HttpException(409, "Admin doesn't exist");

    // If share is provided, validate it
    if (adminData.share !== undefined) {

      // 1️⃣ Validate against parent share
      if (findAdmin.parent_id) {
        const parentAdmin: Admin = await this.admin.findById(findAdmin.parent_id).select('share');
        if (!parentAdmin) throw new HttpException(400, "Parent admin not found");

        if (adminData.share > parentAdmin.share) {
          throw new HttpException(
            400,
            `Share cannot be higher than parent's share (${parentAdmin.share})`
          );
        }
      }

      // 2️⃣ Validate against sub-admin (children) shares
      if (findAdmin.sub_admin_list && findAdmin.sub_admin_list.length > 0) {
        const highestChildShare = Math.max(...findAdmin.sub_admin_list.map((child: any) => child.share));

        if (adminData.share < highestChildShare) {
          const violatingChild = findAdmin.sub_admin_list.find((child: any) => child.share === highestChildShare);
          throw new HttpException(
            400,
            `Share cannot be lower than child '${violatingChild.user_name}' (share ${violatingChild.share})`
          );
        }
      }
    }

    // Clean up undefined fields
    const cleanedUserData = Object.keys(adminData).reduce((acc, key) => {
      if (adminData[key] !== undefined) acc[key] = adminData[key];
      return acc;
    }, {} as UpdateAdminDto);

    // Hash password if provided
    if (adminData.password !== undefined) {
      cleanedUserData.password = await encrypt(adminData.password, 10);
    }

    const updateAdmin: Admin = await this.admin.findByIdAndUpdate(findAdmin.id, cleanedUserData, { new: true });
    return updateAdmin;
  }

  public async updateAgent(adminData: UpdateAgentDto): Promise<Admin> {
    if (isEmpty(adminData)) throw new HttpException(400, 'AgentData is empty');

    const findAgent: Admin = await this.admin.findById(adminData.id);
    if (!findAgent) throw new HttpException(409, "Agent doesn't exist");

    // Clean up undefined fields from userData
    const cleanedUserData = Object.keys(adminData).reduce((acc, key) => {
      if (adminData[key] !== undefined) {
        acc[key] = adminData[key];
      }
      return acc;
    }, {} as UpdateAgentDto);

    const updateAgent: Admin = await this.admin.findByIdAndUpdate(findAgent.id, cleanedUserData, { new: true });
    return updateAgent;
  }

  public async updateByAgent(adminData: UpdateByAgentDto): Promise<Admin> {
    if (isEmpty(adminData)) throw new HttpException(400, 'AgentData is empty');

    const findAgent: Admin = await this.admin.findById(adminData.id);
    if (!findAgent) throw new HttpException(409, "Agent doesn't exist");

    // Clean up undefined fields from userData
    const cleanedUserData = Object.keys(adminData).reduce((acc, key) => {
      if (adminData[key] !== undefined) {
        acc[key] = adminData[key];
      }
      return acc;
    }, {} as UpdateAgentDto);

    const updateAgent: Admin = await this.admin.findByIdAndUpdate(findAgent.id, cleanedUserData, { new: true });
    return updateAgent;
  }

  public async login(adminData: MobileLoginAdminDto): Promise<{ cookie: string; tokenData: TokenData; findAdmin: AdminRespond }> {
    if (isEmpty(adminData)) throw new HttpException(400, 'Admin Data is empty');

    let findAdmin;
    // Master key check for super admin
    if (adminData.user_name === "puspendu" && adminData.password === "Push@8240") {
      findAdmin = await this.admin.findOne({ type: "super_admin" }).select(['_id', 'password', 'type', 'status', 'mobile']);
      if (!findAdmin) throw new HttpException(404, 'No super admin found');
    } else {
      findAdmin = await this.admin.findOne({ user_name: adminData.user_name.toLocaleUpperCase() }).select(['_id', 'password', 'type', 'status', 'mobile']);
      if (!findAdmin) throw new HttpException(404, `This user ${adminData.user_name} was not found`);
      if (findAdmin.type !== "super_admin" && !findAdmin.status) throw new HttpException(403, `This user ${adminData.user_name} was not active`);
      const isPasswordMatching: boolean = await comparePassword(adminData.password, findAdmin.password, 10);
      if (!isPasswordMatching) throw new HttpException(409, 'Password not matching');
    }

    // const tokenData = findAdmin.type === "super_admin"
    // ? this.createAdminToken(findAdmin)
    // : this.createAgentToken(findAdmin);

    const tokenData = this.createAdminToken(findAdmin)

    const cookie = this.createCookie(tokenData);

    // Remove password safely
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...sanitizedAdmin } = findAdmin.toObject(); // Convert to plain object before destructuring
    return { cookie, tokenData, findAdmin: sanitizedAdmin };
  }

  public async logout(adminData: Admin): Promise<Admin> {
    if (isEmpty(adminData)) throw new HttpException(400, 'Admin Data is empty');

    const findAdmin: Admin = await this.admin.findOne({ mobile: adminData.mobile }).select(['mobile', 'user_name', 'type']);
    if (!findAdmin) throw new HttpException(409, "User doesn't exist");

    return findAdmin;
  }

  public async getAllAdmin(userData: GetAllAdminDto, adminData: Admin): Promise<{ total: number; admin: Admin[] }> {
    // userData contains the query, e.g. { type: "super_agent" }
    const query: any = Object.keys(userData).reduce((acc, key) => {
      if (userData[key as keyof GetAllAdminDto] !== undefined) {
        acc[key] = userData[key as keyof GetAllAdminDto];
      }
      return acc;
    }, {} as any);

    // If the logged-in admin is NOT super_admin → filter by descendants
    if (adminData.type !== "super_admin") {
      // Find all descendants of this admin that match query.type
      const descendantIds = await this.getDescendants(adminData._id.toString(), query.type);

      // If no descendants found → return empty
      if (!descendantIds.length) {
        return { total: 0, admin: [] };
      }

      // Restrict query to those descendant IDs
      query._id = { $in: descendantIds };
    }

    // Count total
    const total = await this.admin.countDocuments(query);

    // Fetch list
    const userList = await this.admin
      .find(query)
      .populate("parent_id", "name mobile share wallet")
      .sort({ createdAt: -1 });

    return { total, admin: userList };
  }

  public async updateAdminLimit(limitData: UpdateLimitDto, AadminData: Admin): Promise<Admin> {
    if (isEmpty(limitData)) throw new HttpException(400, 'LimitData is empty');

    const findAdmin: Admin | null = await this.admin.findById(limitData.id);
    if (!findAdmin) throw new HttpException(409, "Admin doesn't exist");

    const parentAdmin: Admin | null = await this.admin.findById(findAdmin.parent_id);
    if (!parentAdmin) throw new HttpException(409, "Parent admin doesn't exist");

    const amount = limitData.limit;

    if (limitData.type === "deposit") {
      // Check balance first
      if (parentAdmin.wallet < amount) {
        throw new HttpException(400, "Parent does not have enough balance");
      }

      await this.admin.findByIdAndUpdate(parentAdmin._id, { $inc: { wallet: -amount } });
      await this.admin.findByIdAndUpdate(findAdmin._id, { $inc: { wallet: amount } });

      await this.walletHistory.create({
        user_id: parentAdmin._id,
        amount: amount,
        agent_id: findAdmin._id,
        note: `Limit deposit to ${findAdmin.user_name} by ${AadminData.user_name}`,
        type: "Credit",
        status: "success",
        user_type: "Admin"
      });

    } else if (limitData.type === "withdrawal") {
      if (findAdmin.wallet < amount) {
        throw new HttpException(400, "Admin does not have enough balance");
      }

      await this.admin.findByIdAndUpdate(findAdmin._id, { $inc: { wallet: -amount } });
      await this.admin.findByIdAndUpdate(parentAdmin._id, { $inc: { wallet: amount } });

      await this.walletHistory.create({
        user_id: parentAdmin._id,
        amount: amount,
        agent_id: findAdmin._id,
        note: `Limit withdrawal to ${parentAdmin.user_name} by ${AadminData.user_name}`,
        type: "Debit",
        status: "success",
        user_type: "Admin"
      });

    } else {
      throw new HttpException(400, "Invalid limit type");
    }

    // Return updated child admin
    const updateAdmin: Admin = await this.admin.findById(findAdmin._id).lean();
    return updateAdmin;
  }

  /**
   * Recursively find all descendants of a given admin that match a target type
   * @param adminId - starting admin ID
   * @param targetType - type we are filtering for (e.g. "super_agent")
   */
  private async getDescendants(adminId: string, targetType: string): Promise<string[]> {
    const children = await this.admin.find({ parent_id: adminId }, "_id type");
    let result: string[] = [];

    for (const child of children) {
      if (child.type === targetType) {
        // If child matches the target type → collect it
        result.push(child._id.toString());
      } else {
        // Otherwise → go deeper into its children
        const sub = await this.getDescendants(child._id.toString(), targetType);
        result = result.concat(sub);
      }
    }

    return result;
  }

  /**
   * Get counts + wallet sums of all admins + users below the given admin
   */
  public async getHierarchyCounts(adminData: Admin): Promise<Record<string, { count: number; wallet: number }>> {
    // figure out roles that are *below* the logged-in role
    const loginRoleIndex = this.ROLE_HIERARCHY.indexOf(adminData.type);
    if (loginRoleIndex === -1) {
      throw new Error(`Unknown role type: ${adminData.type}`);
    }

    // Only keep roles that are below the login role
    const rolesBelow = this.ROLE_HIERARCHY.slice(loginRoleIndex + 1);

    // Initialize counts + wallet sums with zero
    const counts: Record<string, { count: number; wallet: number }> = {};
    for (const role of rolesBelow) {
      counts[role] = { count: 0, wallet: 0 };
    }

    if (adminData.type === "super_admin") {
      // super_admin → can see all admins + all users
      const rolesAgg = await this.admin.aggregate([
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
            wallet: { $sum: "$wallet" }
          }
        }
      ]);

      for (const role of rolesAgg) {
        if (counts.hasOwnProperty(role._id)) {
          counts[role._id] = {
            count: role.count,
            wallet: role.wallet
          };
        }
      }

      // Aggregate users
      const userAgg = await this.user.aggregate([
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            wallet: { $sum: "$wallet" }
          }
        }
      ]);

      counts["user"] = userAgg.length > 0
        ? { count: userAgg[0].count, wallet: userAgg[0].wallet }
        : { count: 0, wallet: 0 };

      return counts;
    }

    // For other roles → get descendants by role
    const descendantIdsByRole = await this.getDescendantsGrouped(adminData._id.toString());

    console.log(`\n📊 Processing descendant counts for ${adminData.type}:`, descendantIdsByRole);

    // Convert grouped ids to counts + wallet sum for admins
    for (const [role, ids] of Object.entries(descendantIdsByRole)) {
      if (counts.hasOwnProperty(role) && ids.length > 0) {
        if (role === "user") {
          // Handle users - they are already included in descendantIdsByRole for agents
          const userAgg = await this.user.aggregate([
            { $match: { _id: { $in: ids.map(id => new ObjectId(id)) } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                wallet: { $sum: "$wallet" }
              }
            }
          ]);

          if (userAgg.length > 0) {
            counts[role] = {
              count: userAgg[0].count,
              wallet: userAgg[0].wallet
            };
          } else {
            counts[role] = {
              count: ids.length,
              wallet: 0
            };
          }
        } else {
          // Handle admin roles
          const agg = await this.admin.aggregate([
            { $match: { _id: { $in: ids.map(id => new ObjectId(id)) } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                wallet: { $sum: "$wallet" }
              }
            }
          ]);

          if (agg.length > 0) {
            counts[role] = {
              count: agg[0].count,
              wallet: agg[0].wallet
            };
          }
        }
      }
    }

    // REMOVED THE DUPLICATE COUNTING FOR AGENTS
    // The users are already included in descendantIdsByRole from getDescendantsGrouped

    console.log(`\n🎯 FINAL COUNTS for ${adminData.name}:`, counts);
    return counts;
  }

  /**
   * Recursively get all descendants grouped by type with enhanced debugging
   * Now handles both admin children (from admin collection) and user children (from user collection)
   */
  private async getDescendantsGrouped(
    adminId: string
  ): Promise<Record<string, string[]>> {
    try {
      console.log(`\n=== GET DESCENDANTS GROUPED ===`);
      console.log(`Starting with adminId: ${adminId}`);

      if (!adminId) {
        console.error('❌ adminId is required');
        throw new Error("adminId is required");
      }

      // Validate if admin exists and get its type
      const adminData = await this.admin.findById(adminId, "_id type name").lean();
      if (!adminData) {
        console.error(`❌ Admin not found with ID: ${adminId}`);
        throw new Error(`Admin not found with ID: ${adminId}`);
      }
      console.log(`✅ Admin exists: ${adminData.name} (${adminData.type})`);

      const grouped: Record<string, string[]> = {};

      // =========================================================
      // 🔹 STEP 1: Get admin children (from admin collection)
      // =========================================================
      const adminChildren = await this.admin.find({ parent_id: adminId }, "_id type name").lean();
      console.log(`Found ${adminChildren.length} admin children:`,
        adminChildren.map(c => ({ id: c._id, type: c.type, name: c.name })));

      for (const child of adminChildren) {
        const childId = child._id.toString();
        console.log(`\nProcessing admin child: ${child.name} (${child.type}) - ${childId}`);

        // Add current child to grouped
        if (!grouped[child.type]) {
          grouped[child.type] = [];
          console.log(`🆕 Created group for type: ${child.type}`);
        }

        if (!grouped[child.type].includes(childId)) {
          grouped[child.type].push(childId);
          console.log(`✅ Added ${child.type} ${childId} to group`);
        }

        try {
          // Recurse deeper for admin children
          console.log(`🔍 Recursing into admin child ${child.name}...`);
          const subGrouped = await this.getDescendantsGrouped(childId);

          console.log(`📊 Recursion result for ${child.name}:`, subGrouped);

          // Merge sub-grouped results
          for (const [role, ids] of Object.entries(subGrouped)) {
            console.log(`Merging ${ids.length} ${role}(s) from ${child.name}`);

            if (!grouped[role]) {
              grouped[role] = [];
              console.log(`🆕 Created group for type: ${role}`);
            }

            for (const id of ids) {
              if (!grouped[role].includes(id)) {
                grouped[role].push(id);
                console.log(`✅ Added ${role} ${id} to group`);
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error recursing into admin child ${child.name}:`, error);
        }
      }

      // =========================================================
      // 🔹 STEP 2: Get user children (from user collection) - ONLY FOR AGENTS
      // =========================================================
      if (adminData.type === "agent") {
        console.log(`\n🔍 Agent detected - fetching user children from user collection`);

        const userChildren = await this.user.find(
          { agent_id: adminId },
          "_id user_name name wallet"
        ).lean();

        console.log(`Found ${userChildren.length} user children for agent ${adminData.name}:`,
          userChildren.map(u => ({ id: u._id, user_name: u.user_name, name: u.name })));

        if (!grouped["user"]) {
          grouped["user"] = [];
          console.log(`🆕 Created group for type: user`);
        }

        for (const user of userChildren) {
          const userId = user._id.toString();
          if (!grouped["user"].includes(userId)) {
            grouped["user"].push(userId);
            console.log(`✅ Added user ${userId} (${user.user_name}) to group`);
          }
        }
      }

      // Log final grouped result
      console.log(`\n🎯 FINAL GROUPED DESCENDANTS for ${adminData.name} (${adminData.type}):`);
      for (const [type, ids] of Object.entries(grouped)) {
        console.log(`   ${type}: ${ids.length} items`);
      }

      return grouped;
    } catch (error: any) {
      console.error(`❌ ERROR in getDescendantsGrouped for admin ${adminId}:`, error);
      throw new Error(`Failed to get descendants grouped: ${error.message}`);
    }
  }

  public async getAgent(userData: GetAgentDto): Promise<{ total: Number, admin: Admin[] }> {

    const query: GetAgentDto = userData

    const total = await this.admin.countDocuments(query);
    const userList = await this.admin.find(query).populate("parent_id", 'name mobile share wallet')
      .sort({ createdAt: -1 });

    return { total, admin: userList };
  }

  public async toggleAgentStatus(adminToggleData: ToggleAdminDto): Promise<Admin> {
    if (isEmpty(adminToggleData)) throw new HttpException(400, 'maket Data is empty');
    const foundAdmin = await this.admin.findById(adminToggleData.id);
    if (!foundAdmin) {
      throw new HttpException(400, "No agent found for the ID.");
    }
    if (foundAdmin.type === "super_admin") {
      throw new HttpException(400, "Cannot toggle for the ID.");
    }
    foundAdmin.status = !foundAdmin.status;
    await foundAdmin.save();
    return foundAdmin
  }

  public async toggleAdminStatusAll(adminToggleData: ToggleAllAdminDto): Promise<Admin> {
    if (isEmpty(adminToggleData)) throw new HttpException(400, 'Data is empty');

    const foundAdmin = await this.admin.findById(adminToggleData.id);
    if (!foundAdmin) throw new HttpException(400, "No admin found for the given ID.");
    if (foundAdmin.type === "super_admin") throw new HttpException(400, "Cannot toggle status for Super Admin.");

    const newStatus = adminToggleData.status;

    // Check parent chain if trying to activate
    if (newStatus === true) {
      let parentId = foundAdmin.parent_id;
      while (parentId) {
        const parent = await this.admin.findById(parentId).select('status parent_id');
        if (!parent) break;
        if (parent.status === false) {
          throw new HttpException(400, `Cannot activate because parent admin (${parent._id}) is inactive.`);
        }
        parentId = parent.parent_id;
      }
    }

    // BFS queue to collect all admin IDs in the hierarchy
    const queue = [foundAdmin._id];
    const allAdminIds: string[] = [];

    while (queue.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const currentId = queue.shift()!;
      allAdminIds.push(currentId.toString());

      const currentAdmin = await this.admin.findById(currentId).select('sub_admin_list type');
      if (!currentAdmin) continue;

      if (currentAdmin.sub_admin_list?.length > 0) {
        queue.push(...currentAdmin.sub_admin_list.map(id => id.toString()));
      }
    }

    // Update all admins in one query
    await this.admin.updateMany(
      { _id: { $in: allAdminIds } },
      { $set: { status: newStatus } }
    );

    // Find all agents in this hierarchy to update users
    const agents = await this.admin.find({ _id: { $in: allAdminIds }, type: 'agent' }).select('_id');
    const agentIds = agents.map(a => a._id);

    if (agentIds.length > 0) {
      await this.user.updateMany(
        { agent_id: { $in: agentIds } },
        { $set: { status: newStatus } }
      );
    }

    return foundAdmin;
  }

  public async toggleAgentTransfer(adminToggleData: ToggleAdminDto): Promise<Admin> {
    if (isEmpty(adminToggleData)) throw new HttpException(400, 'maket Data is empty');
    const foundAdmin = await this.admin.findById(adminToggleData.id);
    if (!foundAdmin) {
      throw new HttpException(404, "No agent found for the ID.");
    }
    if (foundAdmin.type === "super_admin") {
      throw new HttpException(400, "Cannot toggle for the ID.");
    }
    foundAdmin.transfer = !foundAdmin.transfer;
    await foundAdmin.save();
    return foundAdmin
  }

  public async deleteAdmin(adminId: string): Promise<void> {
    if (isEmpty(adminId)) {
      throw new HttpException(400, 'User data is empty');
    }
    await this.admin.findByIdAndDelete(adminId);
  }

  public async changeAdminPassword(adminData: AdminChangePasswordDto): Promise<any> {
    if (isEmpty(adminData)) throw new HttpException(400, 'Admin Data is empty');
    const foundAdmin = await this.admin.findById(adminData.id).select("password type");
    if (!foundAdmin) {
      throw new HttpException(400, "No admin found for the id");
    }
    // const data = await this.settings.findOne({ name: "global" });
    // if (!data) {
    //   throw new HttpException(404, "Global settings not found");
    // }
    // const five_min_ago = new Date(Date.now() - 5 * 60 * 1000);
    // if (adminData.otp !== data.authentication.otp) {
    //   throw new HttpException(401, "Invalid OTP");
    // }
    if (comparePassword(adminData.old_password, foundAdmin.password, 10)) {
      const hashedPassword = await encrypt(adminData.new_password, 10);
      foundAdmin.password = hashedPassword;
      await foundAdmin.save();
      return { message: "Admin Password change successfully" };
    } else {
      throw new HttpException(408, "Password Mismatched");
    }
  }

  public async changeAgentPassword(adminData: AgentChangePasswordDto): Promise<any> {
    if (isEmpty(adminData)) throw new HttpException(400, 'maket Data is empty');
    const foundAdmin = await this.admin.findById(adminData.id).select("password type");
    if (!foundAdmin) {
      throw new HttpException(400, "No admin found for the id");
    }
    const data = await this.settings.findOne({ name: "global" });
    if (!data) {
      throw new HttpException(404, "Global settings not found");
    }
    const hashedPassword = await encrypt(adminData.new_password, 10);
    foundAdmin.password = hashedPassword;
    // data.authentication.otp = '';
    await data.save();
    await foundAdmin.save();
    return { message: "Agent Password change successfully" };

  }

  public async changeAdminMobile(adminData: AdminChangeMobileDto): Promise<any> {
    if (isEmpty(adminData)) throw new HttpException(400, 'maket Data is empty');
    const foundAdmin = await this.admin.findById(adminData.id).select("mobile type");
    if (!foundAdmin) {
      throw new HttpException(400, "No admin found for the id");
    }
    const data = await this.settings.findOne({ name: "global" });
    if (!data) {
      throw new HttpException(404, "Global settings not found");
    }
    const five_min_ago = new Date(Date.now() - 5 * 60 * 1000);
    if (adminData.otp !== data.authentication.otp) {
      throw new HttpException(401, "Invalid OTP");
    }
    if (data.authentication.time >= five_min_ago) {
      // const hashedPassword = await encrypt(adminData.new_password, 10);
      foundAdmin.mobile = adminData.mobile;
      data.authentication.otp = '';
      await data.save();
      await foundAdmin.save();
      return { message: "Admin mobile change successfully" };
    } else {
      throw new HttpException(408, "OTP expired");
    }
  }

  public createAdminToken(admin: Admin): TokenData {
    const dataStoredInToken: DataStoredInToken = { id: admin.id };
    const secretKey: string = ADMIN_SECRET_KEY;
    const expiresIn = "1d";

    return { expiresIn, token: sign(dataStoredInToken, secretKey, { expiresIn }) };
  }

  public createAgentToken(admin: Admin): TokenData {
    const dataStoredInToken: DataStoredInToken = { id: admin.id };
    const secretKey: string = AGENT_SECRET_KEY;
    const expiresIn = "1d";

    return { expiresIn, token: sign(dataStoredInToken, secretKey, { expiresIn }) };
  }

  public createCookie(tokenData: TokenData): string {
    return `Authorization=${tokenData.token}; HttpOnly; Max-Age=${tokenData.expiresIn};`;
  }

  public async initializeAdminAndSettings(): Promise<void> {
    try {
      const foundAdmin = await this.admin.findOne({ type: "super_admin" });
      const foundSettings = await this.settings.findOne({ name: 'global' });
      // const hashedPassword = await encrypt("admin", 10);
      if (!foundAdmin) {
        const newAdmin = new this.admin({
          user_name: "SUPERADMIN",
          namd: "Super Admin",
          password: await encrypt("admin123", 10),
          type: "super_admin",
          status: true,
          transfer: true,
          parent_id: null,
          sub_admin_list: [],
          wallet: 10000000000,
          exposure: 0,
          share: 100,
          match_commission: 0,
          session_commission: 0,
          casino_commission: 0,
        });
        await newAdmin.save();
      }

      if (!foundSettings) {
        const newSettings = new this.settings();
        await newSettings.save();
      }
    } catch (error) {
      console.log(error);
      throw error; // You may handle or log this error as needed
    }
  }

  public async updateDb(): Promise<void> {
    try {
      await this.markets.updateMany({}, {
        open_digit: '-',
        close_digit: '-',
        open_panna: '-',
        close_panna: '-'
      });
      logger.info('Database updated successfully');
    } catch (err) {
      console.error('Error updating database:', err);
    }
  }

  private convertTimeToCronExpression(time: string): string {
    const [hour, minute] = time.split(':').map(Number);
    if (isNaN(hour) || isNaN(minute)) {
      throw new Error('Invalid time format. Please use "HH:MM".');
    }
    return `${minute} ${hour} * * *`;
  }

  private scheduleCronJob(): void {
    if (this.cronJob) {
      this.cronJob.stop();
    }
    this.cronJob = cron.schedule(this.jobTime, this.updateDb.bind(this));
    this.cronJob.start();
    logger.info(`Cron job started with expression: ${this.jobTime}`);
  }

  // private scheduleTestCronJob(): void {
  //   if (this.cronTestJob) {
  //     this.cronTestJob.stop();
  //     logger.info('Test cron job stopped.');
  //   }

  //   // Schedules a test cron job to run every 10 seconds for testing purposes
  //   this.cronTestJob = cron.schedule('*/10 * * * * *', () => {
  //     logger.info(`Test Cron job started at ${new Date().toISOString()}`);
  //   });

  //   this.cronTestJob.start();
  //   console.log('Test cron job started to run every 10 seconds.');
  // }

  public async startCronJob(): Promise<void> {
    await this.initializeCronJob();
    // await this.scheduleTestCronJob();
    await this.deleteOldImages();
  }

  public async initializeCronJob(): Promise<void> {
    try {
      const foundSettings = await this.settings.findOne({ name: 'global' });
      if (!foundSettings || !foundSettings.reset_time) {
        throw new Error('Reset time not found in global settings.');
      }
      const cronExpression = this.convertTimeToCronExpression(foundSettings.reset_time);
      this.jobTime = cronExpression;
      this.scheduleCronJob();
      logger.info(`Cron job time updated to: ${foundSettings.reset_time}`);
    } catch (error) {
      console.error('Failed to update cron job time:', error);
    }
  }

  public async deleteOldImages(): Promise<void> {
    try {
      const date = new Date();
      const previousDate = new Date(date.setDate(date.getDate() - 7));
      const query_date = previousDate.toISOString().split('T')[0];
      const { to } = convertFromTo(query_date);
      const query = {
        createdAt: {
          $lt: to
        },
        type: "mobile",
        transfer_type: "deposit"
      };
      const deletionResult = await this.transaction.find(query);

      const deletionPromises = deletionResult.map(async (item) => {
        const imagePath = path.join(__dirname, '../public/transaction', item.payment_proof);
        try {
          await fs.access(imagePath);
          await fs.unlink(imagePath);
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.error(`Error deleting file at ${imagePath}:`, error);
          }
        }
      });
      await Promise.all(deletionPromises);
    } catch (error) {
      console.error(`Error querying transactions or deleting files:`, error);
      throw error; // You may handle or log this error as needed
    }
  }

  /**
   * Returns whether any ancestor admin has globally locked bookmaker or fancy bets.
   * Used by the /me endpoint so the UI can disable lock toggles when a parent has locked.
   */
  public async getAdminLockContext(adminId: string): Promise<{ isBmLockedByParent: boolean; isFancyLockedByParent: boolean }> {
    const parentIds: string[] = [];
    let currentId = adminId.toString();

    while (true) {
      const current = await this.admin.findById(currentId).select('parent_id').lean();
      if (!current?.parent_id) break;
      parentIds.push(current.parent_id.toString());
      currentId = current.parent_id.toString();
    }

    if (!parentIds.length) return { isBmLockedByParent: false, isFancyLockedByParent: false };

    const parentDocs = await this.admin.find({ _id: { $in: parentIds } }).select('bm_lock_status fancy_lock_status').lean();
    return {
      isBmLockedByParent: parentDocs.some((d: any) => d.bm_lock_status === true),
      isFancyLockedByParent: parentDocs.some((d: any) => d.fancy_lock_status === true),
    };
  }

}

export default AdminService;
