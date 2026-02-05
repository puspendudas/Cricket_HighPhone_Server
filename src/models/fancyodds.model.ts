//fancyOdds.model.ts

import { FancyOddsDocument } from '@/interfaces/fancyOdds.interface';
import mongoose, { model, Schema } from 'mongoose';

const fancyOddsSchema = new Schema<FancyOddsDocument>(
    {
        id: { type: String, required: true, select: true },
        matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match" },
        marketId: { type: String, required: true, select: true },
        gameId: { type: String, required: true, select: true },
        market: { type: String, required: true, select: true },
        sid: { type: Number, required: true, select: true },
        b1: { type: String, required: true, select: true },
        bs1: { type: String, required: true, select: true },
        l1: { type: String, required: true, select: true },
        ls1: { type: String, required: true, select: true },
        status: { type: String, required: false, default: "", select: true },
        remark: { type: String, required: false, default: "", select: true },
        min: { type: Number, required: true, default: 0, select: true },
        max: { type: Number, required: true, default: 0, select: true },
        sno: { type: String, required: false, default: null, select: true },
        rname: { type: String, required: true, default: "", select: true },
        isActive: { type: Boolean, required: true, default: false, select: true },
        isEnabled: { type: Boolean, required: true, default: false, select: true },
        isDeclared: { type: Boolean, required: true, default: false, select: true },
        isAuto: { type: Boolean, required: true, default: false, select: true },
        isFancyEnded: { type: Boolean, required: false, default: false, select: true },
        resultScore: { type: String, required: false, default: null, select: true },
    },
    { timestamps: true }
)

// Ultra-performance optimization indexes for sub-150ms response times
fancyOddsSchema.index({ gameId: 1 }); // Primary lookup index for gameId queries
fancyOddsSchema.index({ matchId: 1 }); // Reference lookup index
fancyOddsSchema.index({ gameId: 1, isActive: 1, isEnabled: 1 }); // Compound index for active odds
fancyOddsSchema.index({ marketId: 1, gameId: 1 }); // Market-specific queries

// Additional compound indexes for ultra-fast lookups
fancyOddsSchema.index({ gameId: 1, isActive: 1 }); // Fast active filtering
fancyOddsSchema.index({ gameId: 1, isEnabled: 1 }); // Fast enabled filtering
fancyOddsSchema.index({ isActive: 1, isEnabled: 1, gameId: 1 }); // Optimized for aggregation pipeline
fancyOddsSchema.index({ gameId: 1, sid: 1 }, { unique: true }); // Unique compound index to prevent duplicates

const FancyOddsModel = model<FancyOddsDocument>('FancyOdds', fancyOddsSchema);

export default FancyOddsModel;
