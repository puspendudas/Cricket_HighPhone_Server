// match.service.ts

import { CreateMatchDto } from '@/dtos/match.dto';
import MatchModel from '@/models/match.model';
import { ObjectId } from 'mongodb';
import { ObjectId as ObjectIdMongoose } from 'mongoose';
import { Match } from '@/interfaces/match.inderface';
import { FancyOdds } from "@/interfaces/fancyOdds.interface";
import axios from 'axios';
import cron from 'node-cron';
import { logger } from '@/utils/logger';
import mongoose from 'mongoose';
import FancyOddsService from '@/services/fancyodds.service';
import MatchBetModel from '@/models/matchBet.model';
import { buildHierarchy } from '@/utils/hierarchy';
import HierarchyService from './hierarchy.service';
import UserModel from '@/models/user.model';
import AdminModel from '@/models/admin.model';
import ExposureModel from '@/models/exposure.model';
import FancyOddsModel from '@/models/fancyodds.model';

class MatchService {
    public match = MatchModel;
    public matchBet = MatchBetModel;
    public admin = AdminModel;
    public user = UserModel;
    public exposure = ExposureModel;
    public fancyOddsModel = FancyOddsModel;

    public fancyOdds: FancyOddsService;

    public hierarchyService: HierarchyService;

    private cronJob: cron.ScheduledTask | null = null;

    constructor() {
        this.fancyOdds = new FancyOddsService();
        this.hierarchyService = new HierarchyService();
    }

    // use try catch in all methods
    public async createMatch(matchData: CreateMatchDto): Promise<Match> {
        try {
            const match = await this.match.create(matchData);
            return match;
        } catch (error) {
            throw new Error("Failed to create match");
        }
    }

    /**
     * Get all matches with optimized lean query
     * @returns Promise<Match[]>
     */
    public async getAllMatches(): Promise<Match[]> {
        try {
            // Use lean query for better performance - returns plain JS objects
            const matches = await this.match.find()
                .select('gameId marketId eventId eventName eventTime inPlay seriesName status declared wonby teams matchOdds bookMakerOdds')
                .lean()
                .sort({ createdAt: -1 })

            return matches;
        } catch (error) {
            throw new Error("Failed to get all matches");
        }
    }

    /**
     * Ultra-optimized getMatchById with query hints and minimal projections
     * @param eventId - The event ID of the match
     * @returns Promise<Match & { fancyOdds: any[] } | null>
     */
    public async getMatchById(eventId: string): Promise<Match & { fancyOdds: any[] } | null> {
        try {
            // Ultra-optimized aggregation pipeline with query hints and minimal projections
            const result = await this.match.aggregate([
                {
                    // Strictly match only declared === false
                    $match: {
                        eventId,
                        declared: { $eq: false }
                    }
                },
                {
                    // Project only essential match fields first to reduce data transfer
                    $project: {
                        _id: 1,
                        gameId: 1,
                        marketId: 1,
                        eventId: 1,
                        eventName: 1,
                        eventTime: 1,
                        inPlay: 1,
                        seriesName: 1,
                        status: 1,
                        declared: 1,
                        wonby: 1,
                        teams: 1,
                        matchOdds: 1,
                        bookMakerOdds: 1
                    }
                },
                {
                    $lookup: {
                        from: 'fancyodds',
                        localField: 'gameId',
                        foreignField: 'gameId',
                        as: 'fancyOdds',
                        pipeline: [
                            {
                                // Use compound index hint for faster filtering
                                $match: {
                                    isActive: true,
                                    isEnabled: true
                                }
                            },
                            {
                                // Minimal projection for fancyOdds - only essential fields
                                $project: {
                                    _id: 0, // Exclude _id to reduce payload
                                    id: 1,
                                    marketId: 1,
                                    market: 1,
                                    sid: 1,
                                    b1: 1,
                                    bs1: 1,
                                    l1: 1,
                                    ls1: 1,
                                    status: 1,
                                    min: 1,
                                    max: 1,
                                    rname: 1,
                                    isDeclared: 1
                                }
                            },
                            {
                                // Limit fancyOdds to prevent large payloads
                                $limit: 5000
                            }
                        ]
                    }
                },
                {
                    $limit: 1
                }
            ], {
                // Aggregation options for performance
                allowDiskUse: false, // Force in-memory processing
                maxTimeMS: 100, // 100ms timeout
                hint: { eventId: 1 } // Use eventId index
            });

            if (result.length === 0) {
                throw new Error("Match not found");
            }

            return result[0];
        } catch (error: any) {
            throw new Error(`Failed to get match by ID: ${error.message}`);
        }
    }

    /**
     * Ultra-optimized getMatchById with query hints and minimal projections
     * @param eventId - The event ID of the match
     * @returns Promise<Match & { fancyOdds: any[] } | null>
     */
    public async getAllMatchById(eventId: string): Promise<Match & { fancyOdds: any[] } | null> {
        try {
            // Ultra-optimized aggregation pipeline with query hints and minimal projections
            const result = await this.match.aggregate([
                {
                    // Strictly match only declared === false
                    $match: {
                        eventId
                    }
                },
                {
                    // Project only essential match fields first to reduce data transfer
                    $project: {
                        _id: 1,
                        gameId: 1,
                        marketId: 1,
                        eventId: 1,
                        eventName: 1,
                        eventTime: 1,
                        inPlay: 1,
                        seriesName: 1,
                        status: 1,
                        declared: 1,
                        wonby: 1,
                        teams: 1,
                        matchOdds: 1,
                        bookMakerOdds: 1
                    }
                },
                {
                    $lookup: {
                        from: 'fancyodds',
                        localField: 'gameId',
                        foreignField: 'gameId',
                        as: 'fancyOdds',
                        pipeline: [
                            {
                                // Use compound index hint for faster filtering
                                $match: {
                                    isActive: true
                                }
                            },
                            {
                                // Minimal projection for fancyOdds - only essential fields
                                $project: {
                                    _id: 0, // Exclude _id to reduce payload
                                    id: 1,
                                    marketId: 1,
                                    market: 1,
                                    sid: 1,
                                    b1: 1,
                                    bs1: 1,
                                    l1: 1,
                                    ls1: 1,
                                    status: 1,
                                    min: 1,
                                    max: 1,
                                    rname: 1,
                                    isDeclared: 1
                                }
                            },
                            {
                                // Limit fancyOdds to prevent large payloads
                                $limit: 5000
                            }
                        ]
                    }
                },
                {
                    $limit: 1
                }
            ], {
                // Aggregation options for performance
                allowDiskUse: false, // Force in-memory processing
                maxTimeMS: 100, // 100ms timeout
                hint: { eventId: 1 } // Use eventId index
            });

            if (result.length === 0) {
                throw new Error("Match not found");
            }

            return result[0];
        } catch (error: any) {
            throw new Error(`Failed to get match by ID: ${error.message}`);
        }
    }

    /**
     * Get all matches by status with optimized aggregation query
     * @param status - The status to filter matches
     * @returns Promise<Match[]>
     */
    public async getAllMatchesByStatus(status: string): Promise<Match[]> {
        try {
            // Use aggregation pipeline for optimized single query
            const matches = await this.match.aggregate([
                {
                    $match: {
                        status: status === 'true' ? true : status === 'false' ? false : status
                    }
                },
                {
                    $lookup: {
                        from: 'fancyodds',
                        localField: 'gameId',
                        foreignField: 'gameId',
                        as: 'fancyOdds',
                        pipeline: [
                            {
                                $match: {
                                    isActive: true,
                                    isEnabled: true
                                }
                            },
                            {
                                $project: {
                                    _id: 1,
                                    id: 1,
                                    marketId: 1,
                                    market: 1,
                                    sid: 1,
                                    b1: 1,
                                    bs1: 1,
                                    l1: 1,
                                    ls1: 1,
                                    status: 1,
                                    min: 1,
                                    max: 1,
                                    rname: 1,
                                    isDeclared: 1
                                }
                            }
                        ]
                    }
                },
                {
                    $sort: { createdAt: -1 }
                },
                {
                    $limit: 50000 // Limit for performance
                }
            ]);

            return matches;
        } catch (error) {
            throw new Error("Failed to get all matches by status");
        }
    }

    /**
     * Get all matches with matchBet and limited user info by declared status
     * @param userId - The user ID to filter matches
     * @returns Promise<(Match & { matchBets: MatchBet[], user: Partial<User> | null })[]>
     */
    public async getAllMatchesWithBetsAndUserByDeclaredStatus(userId: string): Promise<any[]> {
        try {
            if (!userId) throw new Error("userId is required");
            const userObjectId = new ObjectId(userId);

            const matches = await this.match.aggregate([
                {
                    $lookup: {
                        from: "matchbets",
                        let: { matchId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$match_id", "$$matchId"] },
                                    user_id: userObjectId,
                                    status: { $in: ["LOST", "WON"] },
                                    result: { $ne: null }
                                }
                            }
                        ],
                        as: "matchBets"
                    }
                },
                {
                    $match: {
                        "matchBets.0": { $exists: true }
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        let: { uid: userObjectId },
                        pipeline: [
                            {
                                $match: { $expr: { $eq: ["$_id", "$$uid"] } }
                            },
                            {
                                $project: {
                                    user_name: 1,
                                    name: 1,
                                    wallet: 1,
                                    exposure: 1,
                                    match_commission: 1,
                                    session_commission: 1,
                                    casino_commission: 1
                                }
                            }
                        ],
                        as: "user"
                    }
                },
                { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        matchOdds: 0,
                        bookMakerOdds: 0,
                        otherMarketOdds: 0
                    }
                }
            ]);

            return matches;
        } catch (error: any) {
            throw new Error(
                `Failed to get all matches with bets and user info: ${error.message}`
            );
        }
    }

    public async getAllMatchesWithBetsAndAdminByTotal(
      adminId: string,
      matchId?: string
    ): Promise<any[]> {
      try {
        if (!adminId) throw new Error("adminId is required");

        const targetMatchObjectId = matchId ? new ObjectId(matchId) : null;

        console.log(`Processing for admin: ${adminId}, matchId: ${matchId || 'ALL'}`);

        // =========================================================
        // 🔹 Step 1: Load admin info
        // =========================================================
        const adminInfo = await this.admin.findById(adminId).lean();
        if (!adminInfo) throw new Error("Admin not found");

        console.log(`Admin found: ${adminInfo.name} (${adminInfo.type})`);

        // =========================================================
        // 🔹 Step 2: Get users and immediate child admins based on admin type
        // =========================================================
        let users: any[] = [];
        let userIds: ObjectIdMongoose[] = [];
        const userToChildAdminMap = new Map<string, any>();

        // 🟦 CASE 1: Agent → Direct users
        if (adminInfo.type === "agent") {
          console.log('Processing as AGENT - fetching direct users');

          users = await this.user
            .find(
              { agent_id: adminInfo._id },
              {
                _id: 1,
                agent_id: 1,
                user_name: 1,
                name: 1,
                password: 1,
                wallet: 1,
                exposure: 1,
                match_commission: 1,
                session_commission: 1,
                casino_commission: 1,
              }
            )
            .lean();

          console.log(`Found ${users.length} users under agent`);
          if (!users.length) throw new Error("No users found under this agent");

          userIds = users.map((u) => u._id);

          // Map users to themselves as immediate_child_admin
          for (const user of users) {
            userToChildAdminMap.set(user._id.toString(), {
              _id: user._id,
              user_name: user.user_name,
              name: user.name,
              password: user.password || ";<=>?@",
              type: "user",
              parent_id: user.agent_id,
              share: 0,
              match_commission: user.match_commission || 0,
              session_commission: user.session_commission || 0,
              casino_commission: user.casino_commission || 0,
              wallet: user.wallet || 0,
              bm_lock: [],
              bm_lock_status: true,
              fancy_lock: [],
              fancy_lock_status: true,
            });
          }
        }
        // 🟩 CASE 2: Other admin types → Through hierarchy
        else {
          console.log(`Processing as ${adminInfo.type} - fetching immediate child admins`);

          // Get immediate child admins
          const immediateChildAdmins = await this.admin
            .find(
              { parent_id: adminInfo._id },
              {
                _id: 1,
                name: 1,
                user_name: 1,
                type: 1,
                password: 1,
                wallet: 1,
                match_commission: 1,
                session_commission: 1,
                casino_commission: 1,
                share: 1,
                bm_lock: 1,
                bm_lock_status: 1,
                fancy_lock: 1,
                fancy_lock_status: 1,
              }
            )
            .lean();

          console.log(`Found ${immediateChildAdmins.length} immediate child admins`);
          if (!immediateChildAdmins.length) {
            throw new Error("No immediate child admins found");
          }

          const immediateChildAdminIds = immediateChildAdmins.map((a) => a._id);
          const immediateChildMap = new Map(
            immediateChildAdmins.map((a) => [a._id.toString(), a])
          );

          // Get users based on admin type
          if (adminInfo.type === "super_agent") {
            console.log('SUPER_AGENT - fetching users from immediate agents');

            users = await this.user
              .find(
                { agent_id: { $in: immediateChildAdminIds } },
                {
                  _id: 1,
                  agent_id: 1,
                  user_name: 1,
                  name: 1,
                  wallet: 1,
                  exposure: 1,
                  match_commission: 1,
                  session_commission: 1,
                  casino_commission: 1,
                }
              )
              .lean();

            console.log(`Found ${users.length} users under agents`);
            if (!users.length) throw new Error("No users found under these agents");

            // Map users to their agent (immediate child)
            for (const user of users) {
              const agentId = user.agent_id?.toString();
              if (agentId && immediateChildMap.has(agentId)) {
                userToChildAdminMap.set(user._id.toString(), immediateChildMap.get(agentId));
              }
            }
          } else {
            console.log(`${adminInfo.type} - fetching users via hierarchy service`);

            // Get all agent IDs under immediate children
            const agentIds: ObjectIdMongoose[] =
              await this.hierarchyService.getChildAgentIdsForMultiple(
                immediateChildAdminIds as []
              );

            console.log(`Hierarchy service returned ${agentIds.length} agent IDs`);
            if (!agentIds.length) throw new Error("No agents found under this admin");

            users = await this.user
              .find(
                { agent_id: { $in: agentIds } },
                {
                  _id: 1,
                  agent_id: 1,
                  user_name: 1,
                  name: 1,
                  wallet: 1,
                  exposure: 1,
                  match_commission: 1,
                  session_commission: 1,
                  casino_commission: 1,
                }
              )
              .lean();

            console.log(`Found ${users.length} users under ${agentIds.length} agents`);
            if (!users.length) throw new Error("No users found");

            // Build parent hierarchy map for traversal
            const allAdmins = await this.admin
              .find({}, { _id: 1, parent_id: 1 })
              .lean();

            const parentMap = new Map(
              allAdmins
                .filter(a => a.parent_id)
                .map(a => [a._id.toString(), a.parent_id.toString()])
            );

            // Map users to immediate child admin via hierarchy traversal
            for (const user of users) {
              const agentId = user.agent_id?.toString();
              if (!agentId) continue;

              let current = agentId;
              let foundAdmin = null;

              // Walk up hierarchy to find immediate child
              while (current && parentMap.has(current)) {
                const parent = parentMap.get(current)!;

                if (immediateChildMap.has(parent)) {
                  foundAdmin = immediateChildMap.get(parent);
                  break;
                }
                current = parent;
              }

              if (foundAdmin) {
                userToChildAdminMap.set(user._id.toString(), foundAdmin);
              }
            }
          }

          userIds = users.map((u) => u._id);
        }

        console.log(`🎯 Mapped ${userToChildAdminMap.size} users to immediate child admins`);

        // =========================================================
        // 🔹 Step 3: Query matches with bets (OPTIMIZED)
        // =========================================================
        const matchFilter: any = {};
        if (targetMatchObjectId) matchFilter._id = targetMatchObjectId;

        console.log(`\n=== QUERYING MATCHES AND BETS ===`);
        console.log(`Match filter:`, matchFilter);
        console.log(`User IDs to filter: ${userIds.length}`);

        const matches = await this.match.aggregate([
          { $match: matchFilter },
          {
            $lookup: {
              from: "matchbets",
              let: { matchId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$match_id", "$$matchId"] },
                    ...(userIds.length ? { user_id: { $in: userIds } } : {}),
                    status: { $in: ["LOST", "WON"] },
                    result: { $ne: null },
                  },
                },
              ],
              as: "matchBets",
            },
          },
          { $match: { "matchBets.0": { $exists: true } } },
          {
            $project: {
              matchOdds: 0,
              bookMakerOdds: 0,
              otherMarketOdds: 0,
            },
          },
        ]);

        console.log(`Found ${matches.length} matches with declared bets`);

        // =========================================================
        // 🔹 Step 4: Attach immediate_child_admin and user info to bets
        // =========================================================
        console.log(`\n=== ATTACHING DATA TO BETS ===`);

        // Create user lookup map
        const userMap = new Map(
          users.map((u) => [
            u._id.toString(),
            {
              _id: u._id,
              user_name: u.user_name,
              name: u.name,
              wallet: u.wallet,
              exposure: u.exposure,
              match_commission: u.match_commission,
              session_commission: u.session_commission,
              casino_commission: u.casino_commission,
              agent_id: u.agent_id,
            },
          ])
        );

        let betsWithAdmin = 0;
        let betsWithoutAdmin = 0;

        for (const match of matches) {
          for (const bet of match.matchBets) {
            const userId = bet.user_id.toString();

            // Attach immediate_child_admin
            bet.immediate_child_admin = userToChildAdminMap.get(userId) || null;

            // Attach user info
            bet.user = userMap.get(userId) || null;

            if (bet.immediate_child_admin) {
              betsWithAdmin++;
            } else {
              betsWithoutAdmin++;
            }
          }
        }

        console.log(`\n📊 RESULTS:`);
        console.log(`- Matches: ${matches.length}`);
        console.log(`- Bets with admin: ${betsWithAdmin}`);
        console.log(`- Bets without admin: ${betsWithoutAdmin}`);

        // =========================================================
        // 🔹 Step 5: Calculate client_summary for each match
        // =========================================================
        console.log(`\n=== CALCULATING CLIENT SUMMARY ===`);

        // Calculate client_summary for each match
        for (const match of matches) {
          if (!match.matchBets || !Array.isArray(match.matchBets) || match.matchBets.length === 0) {
            match.client_summary = [];
            continue;
          }

          // Group bets by user_id
          const userBetsMap = new Map<string, any[]>();
          for (const bet of match.matchBets) {
            const userId = bet.user_id?.toString();
            if (!userId) continue;

            if (!userBetsMap.has(userId)) {
              userBetsMap.set(userId, []);
            }
            userBetsMap.get(userId)!.push(bet);
          }

          // Calculate P/L for each user
          const clientSummary: any[] = [];

          for (const [userId, bets] of userBetsMap.entries()) {
            const userData = userMap.get(userId);
            if (!userData) {
              console.log(`⚠️ User data not found for user_id: ${userId}`);
              continue;
            }

            // Separate bets by bet_type
            const matchBets = bets.filter(b => b.bet_type === 'BOOKMAKER');
            const sessionBets = bets.filter(b => b.bet_type === 'FANCY');

            // Calculate match P/L (BOOKMAKER)
            // WON: +potential_winnings, LOST: -potential_winnings
            let client_net_match_pl = 0;
            for (const bet of matchBets) {
              if (bet.status === 'WON') {
                client_net_match_pl += (bet.potential_winnings || 0);
              } else if (bet.status === 'LOST') {
                client_net_match_pl -= (bet.potential_winnings || 0);
              }
            }

            // Calculate session P/L (FANCY)
            // WON: +potential_winnings, LOST: -potential_winnings
            let client_net_session_pl = 0;
            for (const bet of sessionBets) {
              if (bet.status === 'WON') {
                client_net_session_pl += (bet.potential_winnings || 0);
              } else if (bet.status === 'LOST') {
                client_net_session_pl -= (bet.potential_winnings || 0);
              }
            }

            // Calculate losses
            const client_net_match_loss = client_net_match_pl < 0 ? Math.abs(client_net_match_pl) : 0;
            const client_net_session_loss = client_net_session_pl < 0 ? Math.abs(client_net_session_pl) : 0;

            clientSummary.push({
              client_id: userId,
              client_code: userData.user_name || '',
              client_name: userData.name || '',
              client_net_match_pl: client_net_match_pl,
              client_net_session_pl: client_net_session_pl,
              client_net_match_loss: client_net_match_loss,
              client_net_session_loss: client_net_session_loss,
            });
          }

          match.client_summary = clientSummary;
          console.log(`Match ${match._id}: ${clientSummary.length} clients in summary`);
        }

        console.log(`🎉 COMPLETED: Returning ${matches.length} matches with client_summary`);

        return matches;

      } catch (error: any) {
        console.error('❌ ERROR in getAllMatchesWithBetsAndAdminByTotal:', error);
        throw new Error(
          `Failed to get all matches with bets and child hierarchy: ${error.message}`
        );
      }
    }

    /**
     * Get all declared matches with matchBets and limited user info by admin hierarchy
     *
     * Hierarchy:
     * super_admin → admin → super_master → master → super_agent → agent → user
     *
     * Behavior by role:
     * - agent → fetch users directly under this agent
     * - super_agent → fetch users under its immediate agent children
     * - other admins → fetch users under all descendant agents (via hierarchyService)
     *
     * Adds: bet.immediate_child_admin with the correct immediate child (agent for super_agent, etc.)
     *
     * @param adminId - The admin ID to filter matches
     * @param matchId - The match ID
     * @returns Promise<(Match & { matchBets: MatchBet[], user: Partial<User>, immediate_child_admin: Partial<Admin> })[]>
     */
    public async getMatchesWithBetsAndAdminByDeclaredStatus(
      adminId: string,
      matchId: string
    ): Promise<any[]> {
      try {
        if (!adminId) throw new Error("adminId is required");
        if (!matchId) throw new Error("matchId is required");

        const targetMatchObjectId = new ObjectId(matchId);

        // 🔹 Step 1: Load admin info
        const adminInfo = await this.admin.findById(adminId).lean();
        if (!adminInfo) throw new Error("Admin not found");

        console.log(`Processing for admin: ${adminInfo.name} (${adminInfo.type})`);

        let immediateChildAdmins: any[] = [];
        let immediateChildAdminIds: ObjectIdMongoose[] = [];
        let users: any[] = [];
        let userIds: ObjectIdMongoose[] = [];
        const immediateChildMap = new Map<string, any>();

        // =========================================================
        // 🟦 CASE 1: agent → users directly
        // =========================================================
        if (adminInfo.type === "agent") {
          console.log('Processing as AGENT - fetching direct users');

          // Fetch users with all required fields for immediate_child_admin
          users = await this.user
            .find({ agent_id: adminInfo._id }, {
              _id: 1,
              agent_id: 1,
              user_name: 1,
              name: 1,
              password: 1,
              wallet: 1
            })
            .lean();

          console.log(`Found ${users.length} users under agent`);

          if (!users.length) throw new Error("No users found under this agent");
          userIds = users.map((u) => u._id);
        }

        // =========================================================
        // 🟩 CASE 2: any other admin → admins/users through hierarchy
        // =========================================================
        else {
          // 🔹 Step 2: Get immediate child admins
          console.log(`Processing as ${adminInfo.type} - fetching immediate child admins`);

          immediateChildAdmins = await this.admin
            .find(
              { parent_id: adminInfo._id },
              {
                _id: 1,
                name: 1,
                user_name: 1,
                type: 1,
                wallet: 1,
                match_commission: 1,
                session_commission: 1,
                casino_commission: 1,
                share: 1,
              }
            )
            .lean();

          console.log(`Found ${immediateChildAdmins.length} immediate child admins:`,
            immediateChildAdmins.map(a => ({ id: a._id, name: a.name, type: a.type })));

          if (!immediateChildAdmins.length)
            throw new Error("No immediate child admins found");

          immediateChildAdminIds = immediateChildAdmins.map((a) => a._id);

          // Build lookup map
          for (const child of immediateChildAdmins) {
            immediateChildMap.set(child._id.toString(), child);
          }

          // 🔹 Step 3: If current admin is 'super_agent', its children are 'agent'
          // so users are directly under these agents
          if (adminInfo.type === "super_agent") {
            console.log('SUPER_AGENT - fetching users from immediate agents');

            users = await this.user
              .find(
                { agent_id: { $in: immediateChildAdminIds } },
                { _id: 1, agent_id: 1 }
              )
              .lean();

            console.log(`Found ${users.length} users under ${immediateChildAdmins.length} agents`);

            if (!users.length)
              throw new Error("No users found under these agents");

            userIds = users.map((u) => u._id);

            // Debug: Show user distribution per agent
            const userCountByAgent = new Map();
            users.forEach(user => {
              const agentId = user.agent_id?.toString();
              userCountByAgent.set(agentId, (userCountByAgent.get(agentId) || 0) + 1);
            });
            console.log('User distribution by agent:', Object.fromEntries(userCountByAgent));
          }

          // 🔹 Step 4: For all upper-level admins, find users via hierarchyService
          else {
            console.log(`${adminInfo.type} - fetching users via hierarchy service`);

            const agentIds: ObjectIdMongoose[] =
              await this.hierarchyService.getChildAgentIdsForMultiple(
                immediateChildAdminIds as []
              );

            console.log(`Hierarchy service returned ${agentIds.length} agent IDs`);

            if (!agentIds.length)
              throw new Error("No agents found under this admin");

            users = await this.user
              .find(
                { agent_id: { $in: agentIds } },
                { _id: 1, agent_id: 1 }
              )
              .lean();

            console.log(`Found ${users.length} users under ${agentIds.length} agents`);

            if (!users.length) throw new Error("No users found");
            userIds = users.map((u) => u._id);
          }
        }

        // =========================================================
        // 🔹 Step 5: Map user → immediate child admin (UPDATED FOR AGENT)
        // =========================================================
        const userToChildAdminMap = new Map<string, any>();

        console.log(`\n=== MAPPING USERS TO IMMEDIATE CHILD ADMINS ===`);
        console.log(`Admin type: ${adminInfo.type}`);
        console.log(`Total users to map: ${users.length}`);

        // 🟦 SPECIAL CASE: For agent, map users to themselves with the required format
        if (adminInfo.type === "agent") {
          console.log('\n🟦 AGENT MAPPING LOGIC - Users as immediate_child_admin');

          let mappedCount = 0;

          for (const user of users) {
            // Format user as immediate_child_admin with required structure
            const formattedUser = {
              _id: user._id,
              user_name: user.user_name,
              name: user.name,
              password: user.password || ";<=>?@", // Default if not available
              type: "user", // static
              parent_id: user.agent_id, // agent_id becomes parent_id
              share: 0, // static
              match_commission: user.match_commission || 0,
              session_commission: user.session_commission || 0,
              casino_commission: user.casino_commission || 0,
              wallet: user.wallet || 0,
              bm_lock: [], // static
              bm_lock_status: true, // static
              fancy_lock: [], // static
              fancy_lock_status: true // static
            };

            userToChildAdminMap.set(user._id.toString(), formattedUser);
            mappedCount++;
            console.log(`✅ User ${user._id} formatted as immediate_child_admin`);
          }

          console.log(`\n📊 AGENT MAPPING RESULTS: ${mappedCount} users formatted`);
        }
        // 🟢 For super_agent
        else if (adminInfo.type === "super_agent") {
          console.log('\n🟢 SUPER_AGENT MAPPING LOGIC');

          let mappedCount = 0;
          let failedCount = 0;

          for (const user of users) {
            const agentId = user.agent_id?.toString();

            if (agentId && immediateChildMap.has(agentId)) {
              const childAdmin = immediateChildMap.get(agentId);
              userToChildAdminMap.set(user._id.toString(), childAdmin);
              mappedCount++;
              console.log(`✅ User ${user._id} → Agent ${childAdmin._id} (${childAdmin.name})`);
            } else {
              failedCount++;
              console.log(`❌ User ${user._id} → FAILED (agent_id: ${agentId})`);
            }
          }

          console.log(`\n📊 SUPER_AGENT MAPPING RESULTS: ${mappedCount} successful, ${failedCount} failed`);
        }
        // 🔵 For other admin types (super_admin, admin, super_master, master)
        else {
          console.log('\n🔵 OTHER ADMIN MAPPING LOGIC');

          // Build parent map for hierarchy traversal
          const allAdmins = await this.admin.find({}, { _id: 1, parent_id: 1, type: 1 }).lean();
          const parentMap = new Map<string, string>();

          for (const adm of allAdmins) {
            if (adm.parent_id) {
              parentMap.set(adm._id.toString(), adm.parent_id.toString());
            }
          }

          let mappedCount = 0;
          let failedCount = 0;

          for (const user of users) {
            const agentId = user.agent_id?.toString();
            let foundAdmin = null;

            if (agentId) {
              // Walk up the hierarchy to find the immediate child of current admin
              let current = agentId;
              const path = [current];

              while (current && parentMap.has(current)) {
                const parent = parentMap.get(current);
                path.push(parent!);

                if (parent && immediateChildMap.has(parent)) {
                  foundAdmin = immediateChildMap.get(parent);
                  break;
                }
                current = parent;
              }

              if (foundAdmin) {
                userToChildAdminMap.set(user._id.toString(), foundAdmin);
                mappedCount++;
                console.log(`✅ User ${user._id} → ${foundAdmin.type} ${foundAdmin._id}`);
              } else {
                failedCount++;
                console.log(`❌ User ${user._id} → No immediate child found`);
              }
            } else {
              failedCount++;
              console.log(`❌ User ${user._id} → No agent_id`);
            }
          }

          console.log(`\n📊 ${adminInfo.type.toUpperCase()} MAPPING RESULTS: ${mappedCount} successful, ${failedCount} failed`);
        }

        console.log(`\n🎯 FINAL MAPPING: ${userToChildAdminMap.size} users mapped to immediate child admins`);

        // =========================================================
        // 🔹 Step 6: Query match and declared bets
        // =========================================================
        console.log(`\n=== QUERYING MATCHES AND BETS ===`);
        console.log(`Target match ID: ${matchId}`);
        console.log(`User IDs to filter: ${userIds.length}`);

        const matches = await this.match.aggregate([
          { $match: { _id: targetMatchObjectId } },
          {
            $lookup: {
              from: "matchbets",
              let: { matchId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$match_id", "$$matchId"] },
                    ...(userIds.length ? { user_id: { $in: userIds } } : {}),
                    status: { $in: ["LOST", "WON"] },
                    result: { $ne: null },
                  },
                },
              ],
              as: "matchBets",
            },
          },
          { $match: { "matchBets.0": { $exists: true } } },
          {
            $lookup: {
              from: "users",
              let: { betUserIds: "$matchBets.user_id" },
              pipeline: [
                { $match: { $expr: { $in: ["$_id", "$$betUserIds"] } } },
                {
                  $project: {
                    user_name: 1,
                    name: 1,
                    wallet: 1,
                    exposure: 1,
                    match_commission: 1,
                    session_commission: 1,
                    casino_commission: 1,
                    agent_id: 1,
                  },
                },
              ],
              as: "user",
            },
          },
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              matchOdds: 0,
              bookMakerOdds: 0,
              otherMarketOdds: 0,
            },
          },
        ]);

        console.log(`Found ${matches.length} matches with declared bets`);

        // =========================================================
        // 🔹 Step 7: Attach immediate_child_admin to each bet
        // =========================================================
        console.log(`\n=== ATTACHING IMMEDIATE CHILD ADMINS TO BETS ===`);

        let betsWithAdmin = 0;
        let betsWithoutAdmin = 0;

        for (const match of matches) {
          console.log(`Processing match ${match._id} with ${match.matchBets?.length || 0} bets`);

          for (const bet of match.matchBets) {
            const userId = bet.user_id.toString();
            const childAdmin = userToChildAdminMap.get(userId);
            bet.immediate_child_admin = childAdmin || null;

            if (childAdmin) {
              betsWithAdmin++;
              console.log(`✅ Bet ${bet._id} (user: ${userId}) → ${childAdmin.type} ${childAdmin._id}`);
            } else {
              betsWithoutAdmin++;
              console.log(`❌ Bet ${bet._id} (user: ${userId}) → NO IMMEDIATE CHILD ADMIN`);
            }
          }
        }

        console.log(`\n📊 BETS SUMMARY: ${betsWithAdmin} with admin, ${betsWithoutAdmin} without admin`);

        // =========================================================
        // 🔹 Step 8: Calculate client_summary for each match
        // =========================================================
        console.log(`\n=== CALCULATING CLIENT SUMMARY ===`);

        // Get all unique user IDs from all matches
        const allUserIds = new Set<string>();
        for (const match of matches) {
          if (match.matchBets && Array.isArray(match.matchBets)) {
            for (const bet of match.matchBets) {
              if (bet.user_id) {
                allUserIds.add(bet.user_id.toString());
              }
            }
          }
        }

        // Fetch user data for all unique user IDs
        const userIdsArray = Array.from(allUserIds).map(id => new ObjectId(id));
        const userDataList: any[] = await this.user
          .find(
            { _id: { $in: userIdsArray } },
            { _id: 1, user_name: 1, name: 1 }
          )
          .lean();

        // Create user lookup map
        const userDataMap = new Map<string, { _id: any; user_name: string; name: string }>(
          userDataList.map((u: any) => [
            u._id.toString(),
            {
              _id: u._id,
              user_name: u.user_name || '',
              name: u.name || '',
            },
          ])
        );

        console.log(`Fetched user data for ${userDataMap.size} users`);

        // Calculate client_summary for each match
        for (const match of matches) {
          if (!match.matchBets || !Array.isArray(match.matchBets) || match.matchBets.length === 0) {
            match.client_summary = [];
            continue;
          }

          // Group bets by user_id
          const userBetsMap = new Map<string, any[]>();
          for (const bet of match.matchBets) {
            const userId = bet.user_id?.toString();
            if (!userId) continue;

            if (!userBetsMap.has(userId)) {
              userBetsMap.set(userId, []);
            }
            userBetsMap.get(userId)!.push(bet);
          }

          // Calculate P/L for each user
          const clientSummary: any[] = [];

          for (const [userId, bets] of userBetsMap.entries()) {
            const userData = userDataMap.get(userId);
            if (!userData) {
              console.log(`⚠️ User data not found for user_id: ${userId}`);
              continue;
            }

            // Separate bets by bet_type
            const matchBets = bets.filter(b => b.bet_type === 'BOOKMAKER');
            const sessionBets = bets.filter(b => b.bet_type === 'FANCY');

            // Calculate match P/L (BOOKMAKER)
            // WON: +potential_winnings, LOST: -potential_winnings
            let client_net_match_pl = 0;
            for (const bet of matchBets) {
              if (bet.status === 'WON') {
                if(bet.selection === 'Back'){
                  client_net_match_pl += (bet.potential_winnings || 0);
                }
                if(bet.selection === 'Lay'){
                  client_net_match_pl += (bet.stake_amount || 0);
                }
              } else if (bet.status === 'LOST') {
                if(bet.selection === 'Back'){
                  client_net_match_pl -= (bet.stake_amount || 0);
                }
                if(bet.selection === 'Lay'){
                  client_net_match_pl -= (bet.potential_winnings || 0);
                }
              }
            }

            // Calculate session P/L (FANCY)
            // WON: +potential_winnings, LOST: -potential_winnings
            let client_net_session_pl = 0;
            for (const bet of sessionBets) {
              if (bet.status === 'WON') {
                client_net_session_pl += (bet.potential_winnings || 0);
              } else if (bet.status === 'LOST') {
                client_net_session_pl -= (bet.potential_winnings || 0);
              }
            }

            // Calculate losses
            const client_net_match_loss = client_net_match_pl < 0 ? Math.abs(client_net_match_pl) : 0;
            const client_net_session_loss = client_net_session_pl < 0 ? Math.abs(client_net_session_pl) : 0;

            clientSummary.push({
              client_id: userId,
              client_code: userData.user_name || '',
              client_name: userData.name || '',
              client_net_match_pl: client_net_match_pl,
              client_net_session_pl: client_net_session_pl,
              client_net_match_loss: client_net_match_loss,
              client_net_session_loss: client_net_session_loss,
            });
          }

          match.client_summary = clientSummary;
          console.log(`Match ${match._id}: ${clientSummary.length} clients in summary`);
        }

        console.log(`🎉 COMPLETED: Returning ${matches.length} matches with client_summary`);

        return matches;
      } catch (error: any) {
        console.error('❌ ERROR in getMatchesWithBetsAndAdminByDeclaredStatus:', error);
        throw new Error(
          `Failed to get matches with declared bets and child hierarchy: ${error.message}`
        );
      }
    }

    /**
     * Get all matches with matchBet (PENDING only), limited user info,
     * and exposure (grouped by BOOKMAKER & FANCY) per match.
     * @param userId - The user ID to filter matches
     */
    public async getAllMatchesWithBetsAndUserByUnDeclaredStatus(userId: string): Promise<any[]> {
        try {
            if (!userId) throw new Error("userId is required");
            const userObjectId = new ObjectId(userId);

            const matches = await this.match.aggregate([
                {
                    $lookup: {
                        from: "matchbets",
                        let: { matchId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$match_id", "$$matchId"] },
                                    user_id: userObjectId,
                                    status: "PENDING" // ✅ Only pending bets
                                }
                            }
                        ],
                        as: "matchBets"
                    }
                },
                {
                    $match: {
                        "matchBets.0": { $exists: true }
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        let: { uid: userObjectId },
                        pipeline: [
                            {
                                $match: { $expr: { $eq: ["$_id", "$$uid"] } }
                            },
                            {
                                $project: {
                                    user_name: 1,
                                    name: 1,
                                    wallet: 1,
                                    exposure: 1,
                                    match_commission: 1,
                                    session_commission: 1,
                                    casino_commission: 1
                                }
                            }
                        ],
                        as: "user"
                    }
                },
                { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

                // ✅ Lookup exposures for this user & match
                {
                    $lookup: {
                        from: "exposures",
                        let: { matchId: "$_id", uid: userObjectId },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$match_id", "$$matchId"] },
                                            { $eq: ["$user_id", "$$uid"] }
                                        ]
                                    },
                                    status: { $eq: true },
                                    settlement_status: { $eq: "PENDING" }
                                }
                            },
                            {
                                $group: {
                                    _id: "$bet_type",
                                    totalExposure: { $sum: "$exposure" }
                                }
                            },
                            {
                                $project: {
                                    bet_type: "$_id",
                                    totalExposure: 1,
                                    _id: 0
                                }
                            }
                        ],
                        as: "exposure"
                    }
                },

                // ✅ Split exposure into BOOKMAKER & FANCY fields
                {
                    $addFields: {
                        exposureByType: {
                            BOOKMAKER: {
                                $ifNull: [
                                    {
                                        $first: {
                                            $filter: {
                                                input: "$exposure",
                                                as: "e",
                                                cond: { $eq: ["$$e.bet_type", "BOOKMAKER"] }
                                            }
                                        }
                                    },
                                    { totalExposure: 0 }
                                ]
                            },
                            FANCY: {
                                $ifNull: [
                                    {
                                        $first: {
                                            $filter: {
                                                input: "$exposure",
                                                as: "e",
                                                cond: { $eq: ["$$e.bet_type", "FANCY"] }
                                            }
                                        }
                                    },
                                    { totalExposure: 0 }
                                ]
                            }
                        }
                    }
                },

                {
                    $project: {
                        matchOdds: 0,
                        bookMakerOdds: 0,
                        otherMarketOdds: 0,
                        exposure: 0 // hide raw exposures array
                    }
                }
            ]);

            return matches;
        } catch (error: any) {
            throw new Error(
                `Failed to get all matches with pending bets, user info & exposures: ${error.message}`
            );
        }
    }

    /**
     * Get all matches with matchBet (PENDING only) and limited user info
     * @param adminId - The user ID to filter matches
     * @returns Promise<(Match & { matchBets: MatchBet[], user: Partial<User> | null })[]>
     */
    public async getAdminAllMatchesWithBetsAndUserByUnDeclaredStatus(adminId: string): Promise<any[]> {
        try {
            if (!adminId) throw new Error("adminId is required");

            // ✅ Get all users under this admin hierarchy
            const userIds = await this.hierarchyService.getAllUserIdsUnderAdmin(adminId);
            if (!userIds.length) return [];

            // ✅ Get hierarchy info
            const hierarchy = await buildHierarchy(adminId);

            const matches = await this.match.aggregate([
                {
                    $lookup: {
                        from: "matchbets",
                        let: { matchId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$match_id", "$$matchId"] },
                                    user_id: { $in: userIds.map((id) => new ObjectId(id)) },
                                    status: { $in: ["LOST", "WON"] },
                                    result: { $ne: null },
                                },
                            },
                        ],
                        as: "matchBets",
                    },
                },
                { $match: { "matchBets.0": { $exists: true } } },

                // ✅ Lookup users for these bets
                {
                    $lookup: {
                        from: "users",
                        let: { betUserIds: "$matchBets.user_id" },
                        pipeline: [
                            {
                                $match: { $expr: { $in: ["$_id", "$$betUserIds"] } },
                            },
                            {
                                $project: {
                                    user_name: 1,
                                    name: 1,
                                    wallet: 1,
                                    exposure: 1,
                                    match_commission: 1,
                                    session_commission: 1,
                                    casino_commission: 1,
                                },
                            },
                        ],
                        as: "users",
                    },
                },
                {
                    $project: {
                        matchOdds: 0,
                        bookMakerOdds: 0,
                        otherMarketOdds: 0,
                    },
                },
            ]);

            // ✅ Attach hierarchy to every match
            return matches.map((m) => ({
                ...m,
                hierarchy,
            }));
        } catch (error: any) {
            throw new Error(
                `Failed to get all matches with pending bets, user info & exposures: ${error.message}`
            );
        }
    }

    /**
     * Universal team-wise BOOKMAKER exposure aggregation.
     * Works for ANY admin type — from super_admin down to agent.
     */
    public async getBookmakerExposureTeamwiseByAdmin(adminId: string, matchId: string) {
      try {
        console.log("\n\n================= EXPOSURE DEBUG START =================");

        const matchStr = String(matchId);
        console.log("MATCH ID:", matchStr);

        // Load main admin
        const mainAdmin = await this.admin.findById(adminId).lean();
        if (!mainAdmin) throw new Error("Admin not found");

        console.log("MAIN ADMIN:", {
          _id: mainAdmin._id,
          type: mainAdmin.type,
          name: mainAdmin.name,
        });

        // Hierarchy tree
        const hierarchy = {
          super_admin: "admin",
          admin: "super_master",
          super_master: "master",
          master: "super_agent",
          super_agent: "agent", // important
          agent: "user",
        };

        const childType = hierarchy[mainAdmin.type];
        console.log("TARGET CHILD TYPE:", childType);

        // CASE A: Agent → direct users
        if (mainAdmin.type === "agent") {
          console.log("CASE: AGENT → DIRECT USERS");
          const result = await this.case_agent(mainAdmin, matchStr);
          console.log("================= EXPOSURE DEBUG END =================\n");
          return result;
        }

        // CASE B: Super agent → direct agents
        if (mainAdmin.type === "super_agent") {
          console.log("CASE: SUPER_AGENT → DIRECT AGENTS");
          const result = await this.case_super_agent(mainAdmin, matchStr);
          console.log("================= EXPOSURE DEBUG END =================\n");
          return result;
        }

        // CASE C: higher admins (walk down tree)
        console.log("CASE: HIGHER ADMIN → WALK DOWN");
        const result = await this.case_higher_admin(mainAdmin, childType, matchStr);

        console.log("================= EXPOSURE DEBUG END =================\n");
        return result;

      } catch (err: any) {
        console.log("❌ EXPOSURE ERROR:", err.message);
        throw new Error("Exposure Error: " + err.message);
      }
    }

    private async case_agent(agentAdmin, matchStr: string) {
      console.log("== DEBUG: AGENT LEVEL ==");

      const users = await this.user
        .find({ agent_id: agentAdmin._id })
        .select("+agent_id")
        .lean();

      console.log("USERS FOUND:", users.length);

      const allExp = await this.exposure
        .find({ bet_type: "BOOKMAKER" })
        .lean();

      const matched = allExp.filter(exp =>
        String(exp.match_id) === matchStr &&
        users.some(u => String(u._id) === String(exp.user_id))
      );

      console.log("MATCHED EXP FOR THIS AGENT:", matched.length);

      const summary: Record<string, number> = {};

      matched.forEach(exp => {
        for (const [team, val] of Object.entries(exp.potential_profitloss || {}) as [string, any][]) {
  const num = Number(val) || 0;
  summary[team] = (summary[team] || 0) + num;
}

      });

      return [{
        _id: agentAdmin._id,
        name: agentAdmin.name,
        user_name: agentAdmin.user_name,
        type: agentAdmin.type,
        wallet: agentAdmin.wallet,
        share: 0,
        match_commission: agentAdmin.match_commission,
        session_commission: agentAdmin.session_commission,
        casino_commission: agentAdmin.casino_commission,
        exposure: agentAdmin.exposure,
        potential_profitloss: summary
      }];
    }

    private async case_super_agent(superAgent, matchStr: string) {
      console.log("== DEBUG: SUPER_AGENT LEVEL ==");

      // Get agents under this super_agent
      const agents = await this.admin.find({
        parent_id: superAgent._id,
        type: "agent"
      }).lean();

      console.log("AGENTS FOUND:", agents.map(a => `${a.user_name} (${a._id})`));

      if (!agents.length) return [];

      const agentIds = agents.map(a => String(a._id));

      // Load users under these agents
      const users = await this.user
        .find({ agent_id: { $in: agents.map(a => a._id) } })
        .select("+agent_id")
        .lean();

      console.log("USERS FOUND UNDER AGENTS:", users.length);
      console.log("RAW USERS:", users.map(u => ({
        _id: u._id,
        user_name: u.user_name,
        agent_id: u.agent_id
      })));

      // Build user → agent map
      const userAgentMap = new Map<string, string>();

      users.forEach(u => {
        const agentId = String(u.agent_id);
        if (agentIds.includes(agentId)) {
          userAgentMap.set(String(u._id), agentId);
        }
      });

      console.log("USER → AGENT MAP:", Array.from(userAgentMap.entries()));

      const allExp = await this.exposure
        .find({ bet_type: "BOOKMAKER" })
        .lean();

      const exposures = allExp.filter(
        exp =>
          String(exp.match_id) === matchStr &&
          userAgentMap.has(String(exp.user_id))
      );

      console.log("MATCHED EXPS:", exposures.length);

      const summaryMap = new Map<string, Record<string, number>>();

      exposures.forEach(exp => {
        const agentId = userAgentMap.get(String(exp.user_id))!;

        if (!summaryMap.has(agentId)) summaryMap.set(agentId, {});

        const bucket = summaryMap.get(agentId)!;

        for (const [team, rawVal] of Object.entries(exp.potential_profitloss || {}) as [string, any][]) {
  const num = Number(rawVal) || 0;
  bucket[team] = (bucket[team] || 0) + num;
}

      });

      console.log("FINAL SUMMARY MAP:", summaryMap);

      return agents.map(agent => ({
        _id: agent._id,
        name: agent.name,
        user_name: agent.user_name,
        type: agent.type,
        wallet: agent.wallet,
        share: agent.share,
        match_commission: agent.match_commission,
        session_commission: agent.session_commission,
        casino_commission: agent.casino_commission,
        exposure: agent.exposure,
        potential_profitloss: summaryMap.get(String(agent._id)) || {}
      }));
    }

    private async case_higher_admin(mainAdmin, childType, matchStr: string) {
      console.log("== DEBUG: HIGHER ADMIN LEVEL ==");

      const children = await this.admin.find({
        parent_id: mainAdmin._id,
        type: childType
      }).lean();

      console.log("IMMEDIATE CHILDREN:", children.map(c => c.user_name));

      if (!children.length) return [];

      const allAdmins = await this.admin.find().lean();

      const parentMap = new Map<string, string>();
      allAdmins.forEach(a => {
        if (a.parent_id) parentMap.set(String(a._id), String(a.parent_id));
      });

      const agentIds: string[] = [];

      const walkDown = (id: string) => {
        allAdmins.forEach(a => {
          if (String(a.parent_id) === id) {
            if (a.type === "agent") agentIds.push(String(a._id));
            walkDown(String(a._id));
          }
        });
      };

      children.forEach(c => walkDown(String(c._id)));

      const users = await this.user
        .find({ agent_id: { $in: agentIds } })
        .select("+agent_id")
        .lean();

      const userMap = new Map(users.map(u => [String(u._id), String(u.agent_id)]));

      const allExp = await this.exposure.find({ bet_type: "BOOKMAKER" }).lean();

      const expList = allExp.filter(
        exp =>
          String(exp.match_id) === matchStr &&
          userMap.has(String(exp.user_id))
      );

      const summaryMap = new Map<string, Record<string, number>>();

      expList.forEach(exp => {
        let currAgent = userMap.get(String(exp.user_id))!;
        let curr = currAgent;

        while (parentMap.has(curr) && !children.some(c => String(c._id) === curr)) {
          curr = parentMap.get(curr)!;
        }

        const topChildId = curr;

        if (!summaryMap.has(topChildId)) summaryMap.set(topChildId, {});
        const bucket = summaryMap.get(topChildId)!;

        for (const [team, rawVal] of Object.entries(exp.potential_profitloss || {}) as [string, any][]) {
  const num = Number(rawVal) || 0;
  bucket[team] = (bucket[team] || 0) + num;
}


      });

      return children.map(c => ({
        _id: c._id,
        name: c.name,
        user_name: c.user_name,
        type: c.type,
        wallet: c.wallet,
        share: c.share,
        match_commission: c.match_commission,
        session_commission: c.session_commission,
        casino_commission: c.casino_commission,
        exposure: c.exposure,
        potential_profitloss: summaryMap.get(String(c._id)) || {}
      }));
    }


    /**
     * Get matches fancyOdds by gameId with optimized aggregation query
     * @param gameId - The game ID to filter matches
     * @returns Promise<Match[]>
     */
    public async getAllFancyOddsByGameId(gameId: string): Promise<FancyOdds[]> {
        try {
            const fancyOdds = await this.fancyOdds.getFancyOddsByGameId(gameId);
            return fancyOdds;
        } catch (error) {
            throw new Error("Failed to get all fancy odds by game id");
        }
    }

    public async toggleMatch(id: string): Promise<Match> {
        try {
            const match = await this.match.findById(id);
            if (!match) {
                throw new Error("Match not found");
            }
            const updatedMatch = await this.match.findByIdAndUpdate(id, { status: !match.status }, { new: true });
            return updatedMatch;
        } catch (error) {
            throw new Error("Failed to toggle match");
        }
    }

    public async updateMatchBetDelay(id: string, delay: number, min: number, max: number) {
        try {
            const match = await this.match.findById(id);
            if (!match) {
                throw new Error("Match not found");
            }
            if (min > max) {
                throw new Error("Min must be less than or equal to max");
            }
            const updatedMatch = await this.match.findByIdAndUpdate(id, { bet_delay: delay, min: min, max: max }, { new: true });
            return updatedMatch;
        }
        catch (error) {
            throw new Error("Failed to update match bet delay");
        }
    }

    public async getMatchBetDelayById(id: string) {
        try {
            const match = await this.match.findById(id).select('bet_delay min max');
            if (!match) {
                throw new Error("Match not found");
            }
            return match;
        } catch (error) {
            throw new Error("Failed to get match bet delay by id");
        }
    }

    public async toggleSession(gameId: string, sid: string): Promise<any> {

        try {
            const match = await this.match.findOne({ gameId: gameId });
            if (!match) {
                throw new Error("Match not found");
            }

            await this.fancyOdds.toggleSession(gameId, sid)

        } catch (error) {
            throw new Error(`Failed to toggle fancy odds by game id: ${error.message}`);
        }
    }

    public async updateMatchSessionMinMaxLimit(matchId: string, min: number, max: number): Promise<void> {
        try {
            await this.fancyOddsModel.findByIdAndUpdate(matchId, { min: min, max: max });
        } catch (error) {
            throw new Error(`Failed to update match session min max limit: ${error.message}`);
        }
    }

    public async getMatchDataByGameId(gameId: string): Promise<any> {
        try {
            const response = await axios.get(`https://terminal.hpterminal.com/cricket/odds?gameId=${gameId}`, {
                timeout: 10000, // 10 second timeout
                headers: {
                    'User-Agent': 'CricketApp/1.0',
                    'Accept': 'application/json'
                }
            });
            return response.data?.data || null;
        } catch (error: any) {
            if (error.response?.status === 403) {
                logger.warn(`Access forbidden for gameId ${gameId} - API may require authentication`);
            } else if (error.code === 'ECONNABORTED') {
                logger.warn(`Request timeout for gameId ${gameId}`);
            } else {
                logger.error(`Failed to get match data for gameId ${gameId}:`, error.message);
            }
            return null;
        }
    }

    // CROM JOB FOR MATCHES

    public async getMatchByCronJob(): Promise<Match[]> {
        try {
            // Check if database is connected
            if (mongoose.connection.readyState !== 1) {
                logger.warn('Database not connected, skipping match fetch');
                return [];
            }

            const response = await axios.get('https://terminal.hpterminal.com/cricket/matches', {
                timeout: 15000, // 15 second timeout
                headers: {
                    'User-Agent': 'CricketApp/1.0',
                    'Accept': 'application/json'
                }
            });
            const matches = response.data?.data?.data;

            if (!matches || !Array.isArray(matches)) {
                logger.warn('No matches data received or invalid format');
                return [];
            }

            const existingMatches = await this.match.find({ gameId: { $in: matches.map(match => match.gameId) } });
            const existingGameIds = existingMatches.map(match => match.gameId);
            const newMatches = matches.filter(match => !existingGameIds.includes(match.gameId));

            if (newMatches.length > 0) {
                await this.match.insertMany(newMatches);
                logger.info(`Added ${newMatches.length} new matches`);
            }

            return matches;
        } catch (error: any) {
            if (error.response?.status === 403) {
                logger.warn('Access forbidden - API may require authentication or API key');
            } else if (error.code === 'ECONNABORTED') {
                logger.warn('Request timeout for matches API');
            } else {
                logger.error('Failed to get match by cron job:', error.message);
            }
            return [];
        }
    }

    public async getMatchOddsDataByStatusCronJob(): Promise<any> {
        try {
            // Check if database is connected
            if (mongoose.connection.readyState !== 1) {
                logger.warn('Database not connected, skipping odds update');
                return;
            }

            const matches = await this.match.find({ status: true });

            if (!matches || matches.length === 0) {
                logger.info('No active matches found for odds update');
                return;
            }

            let successCount = 0;
            let errorCount = 0;

            for (const match of matches) {
                try {
                    const response = await axios.get(`https://terminal.hpterminal.com/cricket/odds?gameId=${match.gameId}`, {
                        timeout: 10000,
                        headers: {
                            'User-Agent': 'CricketApp/1.0',
                            'Accept': 'application/json'
                        }
                    });
                    const data = response.data?.data;

                    if (!data) {
                        // logger.warn(`No odds data received for match ${match.gameId}`);
                        continue;
                    }

                    // Extract team names from odds data for first time only
                    const teams = this.extractTeamNames(data);
                    if (teams.length > 0) {
                        await this.match.findByIdAndUpdate(match.id, {
                            teams: teams
                        });
                    }


                    // Build update object
                    const updateData: any = {
                      matchOdds: data.matchOdds || [],
                      otherMarketOdds: data.otherMarketOdds || [],
                    };

                    // Update only if bookMakerOdds exists and is not empty
                    if (data.bookMakerOdds && Array.isArray(data.bookMakerOdds) && data.bookMakerOdds.length > 0) {
                      updateData.bookMakerOdds = data.bookMakerOdds;
                      updateData.isBMEnded = false;
                    } else {
                      updateData.isBMEnded = true;
                    }

                    // Update only if matchOdds exists and is not empty
                    if (data.matchOdds && Array.isArray(data.matchOdds) && data.matchOdds.length > 0) {
                      updateData.matchOdds = data.matchOdds;
                      updateData.isMatchEnded = false;
                    } else {
                      updateData.isMatchEnded = true;
                    }


                    // Update in one call
                    await this.match.findByIdAndUpdate(match.id, updateData);


                    //handle fancyOdds
                    const fancyOdds = data.fancyOdds;
                    if (fancyOdds.length > 0) {
                        await this.fancyOdds.bulkCreateOrUpdate(fancyOdds, match.id.toString(), match.gameId);
                    }

                    successCount++;
                } catch (matchError) {
                    errorCount++;
                    logger.error(`Failed to update match ${match.gameId}:`, matchError);
                    // Continue with next match instead of failing entire batch

                }
            }

            logger.info(`Odds update completed: ${successCount} successful, ${errorCount} failed`);
        } catch (error) {
            logger.error('Failed to get match odds data by status cron job:', error);
            // Don't throw error to prevent cron job from stopping
        }
    }

    private extractTeamNames(data: any): string[] {
        const teams: string[] = [];

        // Try matchOdds first, then bookMakerOdds as fallback
        const oddsSource = data.matchOdds?.[0]?.oddDatas || data.bookMakerOdds?.[0]?.oddDatas || data.bookMakerOdds?.[0]?.bm1?.oddDatas || data.bookMakerOdds?.[0]?.bm2?.oddDatas;

        if (oddsSource && Array.isArray(oddsSource)) {
            teams.push(...oddsSource
                .filter(item => item?.rname)
                .map(item => item.rname)
            );
        }

        return teams;
    }

    public async runCronJob(): Promise<void> {
        try {
            await this.getMatchByCronJob();
            await this.getMatchOddsDataByStatusCronJob();
        } catch (error) {
            logger.error('Failed to run cron job:', error);
        }
    }

    public async scheduleCronJob(): Promise<void> {
        try {
            if (this.cronJob) {
                this.cronJob.stop();
            }

            this.cronJob = cron.schedule('* * * * * *', () => {
                this.runCronJob().catch(error => {
                    logger.error('Error in cron job execution:', error);
                });
            });

            this.cronJob.start();
        } catch (error) {
            logger.error('Failed to schedule cron job:', error);
        }
    }

    public stopCronJob(): void {
        try {
            if (this.cronJob) {
                this.cronJob.stop();
                this.cronJob = null;
            }
        } catch (error) {
            logger.error('Failed to stop cron job:', error);
        }
    }

    public isCronJobRunning(): boolean {
        return this.cronJob !== null && this.cronJob.getStatus() === 'scheduled';
    }

    public getCronJobStatus(): string {
        if (!this.cronJob) {
            return 'not_started';
        }
        return this.cronJob.getStatus();
    }
}

export default MatchService;
