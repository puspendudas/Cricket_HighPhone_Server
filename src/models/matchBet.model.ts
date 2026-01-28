// matchBet.model.ts

import { MatchBetDocument, MatchBetStatus } from '@/interfaces/matchBet.interface';
import mongoose, { model, Schema } from 'mongoose';

const matchBetSchema = new Schema<MatchBetDocument>(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, select: true },
        match_id: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: true, select: true },
        bet_type: { type: String, required: true, select: true }, // BOOKMAKER or FANCY
        selection: { type: String, required: true, select: true }, // Back/Lay for BOOKMAKER, Yes/Not for FANCY
        selection_id: { type: Number, required: false, select: true }, // selectionId for BOOKMAKER bets
        market_id: { type: String, required: false, select: true }, // marketId for FANCY bets
        odds_value: { type: String, required: false, select: true }, // b1/l1 value for FANCY bets
        odds_rate: { type: String, required: true, select: true }, // b1/l1 for BOOKMAKER, bs1/ls1 for FANCY
        stake_amount: { type: Number, required: true, select: true },
        potential_winnings: { type: Number, required: true, select: true },
        status: { type: String, required: true, select: true, default: MatchBetStatus.PENDING },
        result: { type: String, required: false, select: true, default: null },
        settled_at: { type: Date, required: false, select: true, default: null },
        commission: { type: Number, required: false, select: true, default: 0 },
        agent_id: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: false, select: true, default: null },
        team_name: { type: String, required: false, select: true, default: null }, // For BOOKMAKER bets
        session_name: { type: String, required: false, select: true, default: null }, // For FANCY bets
        runner_name: { type: String, required: false, select: true, default: null }, // Runner name for FANCY bets
        game_id: { type: String, required: false, select: true }, // gameId from match/fancyodds
        event_id: { type: String, required: false, select: true }, // eventId from match
        sid: { type: Number, required: false, select: true }, // sid from fancyodds
        min_stake: { type: Number, required: false, select: true, default: 0 }, // min from fancyodds
        max_stake: { type: Number, required: false, select: true, default: 0 }, // max from fancyodds
        is_active: { type: Boolean, required: false, select: true, default: true },
        is_enabled: { type: Boolean, required: false, select: true, default: true },
        bet_metadata: { type: Schema.Types.Mixed, required: false, select: false } // Additional betting data
    },
    { timestamps: true }
)

const MatchBetModel = model<MatchBetDocument>('MatchBet', matchBetSchema);

export default MatchBetModel;
