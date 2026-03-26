/**
 * Ultra-Fast Match Service
 * Specialized service for achieving sub-150ms response times
 * Uses advanced MongoDB optimization techniques
 */

import { Match } from '@/interfaces/match.inderface';
import MatchModel from '@/models/match.model';
import FancyOddsModel from '@/models/fancyodds.model';
import mongoose from 'mongoose';

export class UltraFastMatchService {
    private match = MatchModel;
    private fancyOdds = FancyOddsModel;

    /**
     * Ultra-optimized getMatchById with maximum performance optimizations
     * Target: <150ms response time
     * @param eventId - The event ID of the match
     * @returns Promise<Match & { fancyOdds: any[] } | null>
     */
    public async getMatchByIdUltraFast(eventId: string): Promise<Match & { fancyOdds: any[] } | null> {
        try {
            if (!eventId) {
                return null;
            }

            const session = await mongoose.startSession();

            try {
                const id = String(eventId).trim();
                const result = await this.match.aggregate([
                    {
                        // Join key is often the same as eventId or gameId; support both + string/number BSON.
                        $match: {
                            $and: [
                                { declared: { $eq: false } },
                                {
                                    $expr: {
                                        $or: [
                                            { $eq: [{ $toString: { $ifNull: ['$eventId', ''] } }, id] },
                                            { $eq: [{ $toString: { $ifNull: ['$gameId', ''] } }, id] },
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                    {
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
                            bet_delay: 1,
                            min: 1,
                            max: 1,
                            isBMEnded: 1,
                            isMatchEnded: 1,
                            teams: { $slice: ["$teams", 2] },
                            matchOdds: { $slice: ["$matchOdds", 10] },
                            bookMakerOdds: { $slice: ["$bookMakerOdds", 5] }
                        }
                    },
                    {
                        $lookup: {
                            from: 'fancyodds',
                            let: { matchGameId: '$gameId' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $eq: [
                                                { $toString: { $ifNull: ['$gameId', ''] } },
                                                { $toString: { $ifNull: ['$$matchGameId', ''] } },
                                            ],
                                        },
                                    },
                                },
                                {
                                    $match: {
                                        $and: [{ isActive: true }, { isEnabled: true }],
                                    },
                                },
                                {
                                    $project: {
                                        _id: 0,
                                        id: 1,
                                        marketId: 1,
                                        market: 1,
                                        gameId: 1,
                                        sid: 1,
                                        b1: 1,
                                        bs1: 1,
                                        l1: 1,
                                        ls1: 1,
                                        status: 1,
                                        min: 1,
                                        max: 1,
                                        rname: 1,
                                        isDeclared: 1,
                                        isActive: 1,
                                        isEnabled: 1,
                                        isFancyEnded: 1,
                                    },
                                },
                                { $limit: 3000 },
                            ],
                            as: 'fancyOdds',
                        },
                    },
                    { $limit: 1 }
                ], {
                    allowDiskUse: false,
                    maxTimeMS: 80,
                    readConcern: { level: "local" },
                    session
                });

                if (result.length === 0) {
                    throw new Error("Match not found");
                }

                return result[0];
            } finally {
                await session.endSession();
            }
        } catch (error: any) {
            if (error.message.includes('operation exceeded time limit')) {
                throw new Error('Query timeout - match data too large or indexes missing');
            }
            throw new Error(`Failed to get match by ID: ${error.message}`);
        }
    }



    /**
     * Fallback method using separate optimized queries if aggregation fails
     * @param eventId - The event ID of the match
     * @returns Promise<Match & { fancyOdds: any[] } | null>
     */
    public async getMatchByIdFallback(eventId: string): Promise<Match & { fancyOdds: any[] } | null> {
        try {
            // Ultra-fast match query with minimal projection
            const eid = String(eventId).trim();
            const matchPromise = this.match
                .findOne({
                    declared: false,
                    $expr: {
                        $or: [
                            { $eq: [{ $toString: { $ifNull: ['$eventId', ''] } }, eid] },
                            { $eq: [{ $toString: { $ifNull: ['$gameId', ''] } }, eid] },
                        ],
                    },
                })
                .select('gameId marketId eventId eventName eventTime inPlay seriesName status declared wonby bet_delay min max teams isBMEnded isMatchEnded matchOdds bookMakerOdds')
                .lean()
                .maxTimeMS(50);

            // Get match first
            const match = await matchPromise;
            if (!match) {
                throw new Error("Match not found");
            }

            // Ultra-fast fancyOdds query
            const fancyOddsPromise = this.fancyOdds.find({
                $expr: {
                    $eq: [{ $toString: '$gameId' }, { $toString: match.gameId }],
                },
                isActive: true,
                isEnabled: true,
            })
                .select('id marketId market sid b1 bs1 l1 ls1 status min max rname isDeclared isActive isEnabled isFancyEnded')
                .lean()
                .limit(30)
                .maxTimeMS(30);

            const fancyOdds = await fancyOddsPromise;

            return {
                ...match,
                fancyOdds: fancyOdds || []
            } as Match & { fancyOdds: any[] };
        } catch (error: any) {
            throw new Error(`Fallback query failed: ${error.message}`);
        }
    }

    /**
     * Health check method to verify index performance
     * @returns Promise<{ matchIndexes: any, fancyOddsIndexes: any }>
     */
    public async checkIndexPerformance(): Promise<{ matchIndexes: any, fancyOddsIndexes: any }> {
        try {
            const matchIndexes = await this.match.collection.getIndexes();
            const fancyOddsIndexes = await this.fancyOdds.collection.getIndexes();

            return {
                matchIndexes,
                fancyOddsIndexes
            };
        } catch (error: any) {
            throw new Error(`Index check failed: ${error.message}`);
        }
    }
}

export default UltraFastMatchService;
