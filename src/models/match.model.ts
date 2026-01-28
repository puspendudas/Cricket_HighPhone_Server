// match.model.ts

import { MatchDocument } from '@/interfaces/match.inderface';
import mongoose, { model, Schema } from 'mongoose';

const matchSchema = new Schema<MatchDocument>(
    {
        gameId: { type: String, required: true, select: true },
        marketId: { type: String, required: true, select: true },
        eventId: { type: String, required: true, select: true, index: true },
        eventName: { type: String, required: true, select: true },
        bm_lock: { type: [mongoose.Schema.Types.ObjectId], ref: "Admin", required: true, select: true, default: [] },
        fancy_lock: { type: [mongoose.Schema.Types.ObjectId], ref: "Admin", required: true, select: true, default: [] },
        bet_delay: { type: Number, required: true, select: true, default: 3 },
        selectionId1: { type: Number, required: false, select: false },
        runnerName1: { type: String, required: false, select: false, default: null },
        selectionId2: { type: Number, required: false, select: false },
        runnerName2: { type: String, required: false, select: false, default: null },
        selectionId3: { type: Number, required: false, select: false },
        runnerName3: { type: String, required: false, select: false, default: null },
        eventTime: { type: String, required: true, select: true },
        inPlay: { type: Boolean, required: false, select: true },
        tv: { type: String, required: false, select: false, default: null },
        m1: { type: String, required: false, select: false, default: null },
        f: { type: String, required: false, select: false, default: null },
        vir: { type: Number, required: false, select: false, default: 0 },
        channel: { type: String, required: false, select: false },
        scoreBoardId: { type: String, required: false, select: false },
        seriesId: { type: String, required: false, select: false },
        seriesName: { type: String, required: true, select: true },
        status: { type: Boolean, required: true, select: true, default: false },
        min: { type: Number, required: false, select: true, default: 500 },
        max: { type: Number, required: false, select: true, default: 50000 },
        matchOdds: [{ type: Schema.Types.Mixed }],
        bookMakerOdds: [{ type: Schema.Types.Mixed }],
        isBMEnded: { type: Boolean, required: false, select: true, default: false },
        isMatchEnded: { type: Boolean, required: false, select: true, default: false },
        otherMarketOdds: [{ type: Schema.Types.Mixed }],
        teams: [{ type: Schema.Types.Mixed }],
        declared: { type: Boolean, required: false, select: true, default: false, index: true },
        wonby: { type: String, required: false, select: true, default: null },
    },
    { timestamps: true }
)

// Ultra-performance optimization indexes for sub-150ms response times
matchSchema.index({ eventId: 1 }, { unique: true }); // Primary lookup index with uniqueness
matchSchema.index({ gameId: 1 }); // Secondary lookup index
matchSchema.index({ status: 1, eventTime: 1 }); // Status filtering with time sorting
matchSchema.index({ createdAt: -1 }); // Recent matches sorting

// Compound indexes for optimized projections
matchSchema.index({ eventId: 1, gameId: 1 }); // Combined lookup optimization
matchSchema.index({ gameId: 1, status: 1 }); // Game status queries
matchSchema.index({ status: 1, inPlay: 1, eventTime: 1 }); // Live match filtering
matchSchema.index({ eventId: 1, declared: 1 }); // ✅ REQUIRED for hinted query

const MatchModel = model<MatchDocument>('Match', matchSchema);

export default MatchModel;
