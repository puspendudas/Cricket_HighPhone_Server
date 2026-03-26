// fancyOdds.service.ts

import { FancyOdds, FancyOddsData } from "@/interfaces/fancyOdds.interface";
import { MatchBetStatus } from "@/interfaces/matchBet.interface";
import FancyOddsModel from "@models/fancyodds.model";
import { logger } from "@utils/logger";


class FancyOddsService {
    public fancyOdds = FancyOddsModel;

    public async bulkCreateOrUpdate(
        fancyOddsData: FancyOddsData[],
        matchId: string,
        gameId: string
    ): Promise<string> {
        try {
            const bulkUpdateOps: any[] = [];
            const incomingSidSet = new Set<string>();

            // Flatten and normalize incoming data
            const incomingMap = new Map<string, { data: any, mid: string, market: string }>();
            for (const data of fancyOddsData) {
                const { mid, market, oddDatas } = data;

                for (const oddData of oddDatas) {
                    const sid = oddData.sid.toString();
                    incomingSidSet.add(sid);
                    incomingMap.set(sid, { data: oddData, mid, market });
                }
            }

            // Build upsert operations for ALL incoming data
            // Use upsert for everything to prevent race conditions
            // $set updates fields on both insert and update
            // $setOnInsert only sets fields during insert (new documents)
            for (const [sid, { data: oddData, mid, market }] of incomingMap.entries()) {
                const hasValidOddData = oddData &&
                    (oddData.b1 !== undefined && oddData.b1 !== '') &&
                    (oddData.bs1 !== undefined && oddData.bs1 !== '') &&
                    (oddData.l1 !== undefined && oddData.l1 !== '') &&
                    (oddData.ls1 !== undefined && oddData.ls1 !== '');

                const setFields: any = {
                    b1: oddData.b1,
                    bs1: oddData.bs1,
                    l1: oddData.l1,
                    ls1: oddData.ls1,
                    status: oddData.status || ""
                };

                // UltraFast match aggregation only includes rows with isActive + isEnabled (see ultraFast.match.service).
                // $setOnInsert defaults both to false; without a $set here, upserts never become visible.
                if (hasValidOddData) {
                    setFields.isFancyEnded = false;
                }

                const $setOnInsert: Record<string, any> = {
                    id: `${mid}_${sid}`,
                    matchId: matchId,
                    gameId,
                    marketId: mid,
                    market,
                    sid: Number(sid),
                    remark: oddData.remark || "",
                    min: 100,
                    max: 25000,
                    sno: oddData.sno || null,
                    rname: oddData.rname || "",
                    isDeclared: false,
                    resultScore: ""
                };

                // Remove any keys from $setOnInsert that are already in $set to avoid MongoDB path conflicts
                for (const key of Object.keys(setFields)) {
                    delete $setOnInsert[key];
                }

                bulkUpdateOps.push({
                    updateOne: {
                        filter: { gameId, sid: Number(sid) },
                        update: { $set: setFields, $setOnInsert },
                        upsert: true
                    }
                });
            }

            // Perform all upserts in a single bulkWrite
            if (bulkUpdateOps.length > 0) {
                await this.fancyOdds.bulkWrite(bulkUpdateOps, { ordered: false });
            }

            // Fetch existing odds to check which ones are NOT in incoming data
            const existingFancyOdds = await this.fancyOdds.find({ gameId }).select('sid isEnabled').lean();

            // Mark isFancyEnded = true for objects that exist in DB but NOT in incoming data
            const sidsNotInIncomingToDelete: number[] = [];
            const sidsNotInIncomingToKeep: number[] = [];
            
            for (const existing of existingFancyOdds) {
                const sid = existing.sid.toString();
                if (!incomingSidSet.has(sid)) {
                    if (existing.isEnabled) {
                        sidsNotInIncomingToKeep.push(Number(sid));
                    } else {
                        sidsNotInIncomingToDelete.push(Number(sid));
                    }
                }
            }

            if (sidsNotInIncomingToDelete.length > 0) {
                await this.fancyOdds.deleteMany(
                    { gameId, sid: { $in: sidsNotInIncomingToDelete } }
                );
            }

            if (sidsNotInIncomingToKeep.length > 0) {
                await this.fancyOdds.updateMany(
                    { gameId, sid: { $in: sidsNotInIncomingToKeep } },
                    { $set: { isFancyEnded: true, b1: "", bs1: "", l1: "", ls1: "" } }
                );
            }

            return "Fancy odds created or updated successfully";
        } catch (error: any) {
            throw new Error(`Failed to bulk create fancy odds: ${error.message}`);
        }
    }


    public async getFancyOddsByMatchId(matchId: string): Promise<FancyOdds[]> {
        try {
            const fancyOdds = await this.fancyOdds.find({ matchId: matchId, isActive: true, isEnabled: true });
            return fancyOdds;
        } catch (error) {
            throw new Error(`Failed to get fancy odds by match id: ${error.message}`);
        }
    }

    public async getFancyOddsByGameId(gameId: string): Promise<any[]> {
        try {
            const gid = String(gameId ?? '').trim();
            // Plain { gameId } fails when collection has number and param is string (or vice versa).
            const gameIdMatch = {
                $match: {
                    $expr: {
                        $eq: [
                            { $toString: { $ifNull: ['$gameId', ''] } },
                            { $literal: gid },
                        ],
                    },
                },
            };
            const fancyOddsWithNonDeletedBetCount = await this.fancyOdds.aggregate([
                gameIdMatch,
                {
                    $lookup: {
                        from: "matchbets",
                        let: { sid: "$sid", gameId: "$gameId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: [
                                                    { $toString: { $ifNull: ['$game_id', ''] } },
                                                    { $toString: { $ifNull: ['$$gameId', ''] } },
                                                ],
                                            },
                                            { $eq: ["$sid", "$$sid"] },
                                            { $eq: ["$bet_type", "FANCY"] },
                                            { $ne: ["$status", MatchBetStatus.DELETED] } // ✅ only non-deleted
                                        ]
                                    }
                                }
                            },
                            { $count: "nonDeletedBetCount" }
                        ],
                        as: "nonDeletedBets"
                    }
                },
                {
                    $addFields: {
                        nonDeletedBetCount: {
                            $ifNull: [{ $arrayElemAt: ["$nonDeletedBets.nonDeletedBetCount", 0] }, 0]
                        }
                    }
                },
                { $project: { nonDeletedBets: 0 } }
            ]);

            return fancyOddsWithNonDeletedBetCount;
        } catch (error) {
            throw new Error(`Failed to get fancy odds non-deleted bet counts: ${error.message}`);
        }
    }

    public async toggleSession(gameId: string, sid: string): Promise<any> {
        try {

            // if isEnabled is true then do not change isEnabled
            // if isEnabled is false then change isEnabled to true
            // if isActive is true then change isActive to false
            // if isActive is false then change isActive to true


            // Use a single atomic update with aggregation pipeline (MongoDB 4.2+)
            const updatedFancyOdd = await this.fancyOdds.findOneAndUpdate(
                { gameId, sid: Number(sid) },
                [
                    {
                        $set: {
                            isActive: { $not: "$isActive" },
                            isEnabled: true
                        }
                    }
                ],
                { new: true }
            );

            if (!updatedFancyOdd) {
                throw new Error("Fancy odds not found");
            }

            return updatedFancyOdd;
        } catch (error: any) {
            throw new Error(`Failed to toggle fancy odds by game id: ${error.message}`);
        }
    }

    /**
     * Cleanup duplicate fancyOdds entries by keeping the one with isEnabled=true or the oldest one
     * Call this method at app startup to clean existing duplicates
     */
    public async cleanupDuplicates(): Promise<{ duplicatesRemoved: number }> {
        try {
            // Find all duplicates grouped by gameId + sid
            const duplicates = await this.fancyOdds.aggregate([
                {
                    $group: {
                        _id: { gameId: "$gameId", sid: "$sid" },
                        count: { $sum: 1 },
                        docs: { $push: { _id: "$_id", isEnabled: "$isEnabled", isActive: "$isActive", createdAt: "$createdAt" } }
                    }
                },
                { $match: { count: { $gt: 1 } } }
            ]);

            let totalDeleted = 0;

            for (const dup of duplicates) {
                const docs = dup.docs;

                // Sort: prioritize isEnabled=true, then isActive=true, then oldest (createdAt)
                docs.sort((a: any, b: any) => {
                    if (a.isEnabled !== b.isEnabled) return b.isEnabled ? 1 : -1;
                    if (a.isActive !== b.isActive) return b.isActive ? 1 : -1;
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                });

                // Keep the first one (best match), delete the rest
                const toDelete = docs.slice(1).map((d: any) => d._id);

                if (toDelete.length > 0) {
                    const result = await this.fancyOdds.deleteMany({ _id: { $in: toDelete } });
                    totalDeleted += result.deletedCount;
                }
            }

            logger.info(`[FancyOddsService] Cleanup completed: ${totalDeleted} duplicates removed`);
            return { duplicatesRemoved: totalDeleted };
        } catch (error: any) {
            logger.error(`[FancyOddsService] Cleanup failed: ${error.message}`);
            throw new Error(`Failed to cleanup duplicates: ${error.message}`);
        }
    }

    /**
     * Ensure the unique index on gameId + sid exists
     * Call this after cleanupDuplicates to ensure no future duplicates
     */
    public async ensureUniqueIndex(): Promise<void> {
        try {
            // Drop the old non-unique index if it exists
            try {
                await this.fancyOdds.collection.dropIndex('gameId_1_sid_1');
            } catch (e) {
                // Index might not exist, ignore
            }

            // Create unique compound index
            await this.fancyOdds.collection.createIndex(
                { gameId: 1, sid: 1 },
                { unique: true, background: true }
            );
            logger.info('[FancyOddsService] Unique index on gameId + sid created successfully');
        } catch (error: any) {
            logger.error(`[FancyOddsService] Failed to create unique index: ${error.message}`);
            // Don't throw - index might already exist or duplicates still present
        }
    }

}

export default FancyOddsService;
