// matchBet.interface.ts

import { Document } from 'mongoose';

/**
 * Enum for match bet types
 */
export enum MatchBetType {
  BOOKMAKER = 'BOOKMAKER',
  FANCY = 'FANCY'
}

/**
 * Enum for match bet status
 */
export enum MatchBetStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  WON = 'WON',
  LOST = 'LOST',
  CANCELLED = 'CANCELLED',
  VOID = 'VOID',
  DELETED = 'DELETED'
}

/**
 * Interface for match bet
 */
export interface MatchBet {
  id?: any;
  user_id: any;
  match_id: any;
  bet_type: MatchBetType; // BOOKMAKER or FANCY
  selection: string; // Back/Lay for BOOKMAKER, Yes/Not for FANCY
  selection_id?: number; // selectionId for BOOKMAKER bets
  market_id?: string; // marketId for FANCY bets
  odds_value?: string; // b1/l1 value for FANCY bets
  odds_rate: string; // b1/l1 for BOOKMAKER, bs1/ls1 for FANCY
  stake_amount: number; // Amount user is betting
  potential_winnings: number; // Calculated based on bet type and selection
  status: MatchBetStatus;
  result?: string; // Final result of the bet
  settled_at?: Date;
  commission?: number;
  agent_id?: any;
  team_name?: string; // For BOOKMAKER bets
  session_name?: string; // For FANCY bets
  runner_name?: string; // Runner name for FANCY bets
  game_id?: string; // gameId from match/fancyodds
  event_id?: string; // eventId from match
  sid?: number; // sid from fancyodds
  min_stake?: number; // min from fancyodds
  max_stake?: number; // max from fancyodds
  is_active?: boolean;
  is_enabled?: boolean;
  transaction_id?: any;
  bet_metadata?: any; // Additional betting data
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Interface for match bet document
 */
export interface MatchBetDocument extends MatchBet, Document {
  id: string;
}

/**
 * Interface for creating match bet
 */
export interface CreateMatchBet {
  user_id: string;
  match_id: string;
  bet_type: MatchBetType;
  selection: string; // Back/Lay for BOOKMAKER, Yes/Not for FANCY
  selection_id?: number; // For BOOKMAKER bets
  market_id?: string; // For FANCY bets
  odds_value?: string; // For FANCY bets
  odds_rate: string; // Rate from bookMakerOdds or fancyOdds
  stake_amount: number;
  agent_id?: string;
  team_name?: string;
  session_name?: string;
  runner_name?: string;
  game_id?: string;
  event_id?: string;
  sid?: number;
  min_stake?: number;
  max_stake?: number;
  bet_metadata?: any;
}

/**
 * Interface for match bet response
 */
export interface MatchBetRespond {
  id: string;
  user: MatchBetUser;
  match: MatchBetMatch;
  bet_type: MatchBetType;
  selection: string;
  selection_id?: number;
  market_id?: string;
  odds_value?: string;
  odds_rate: string;
  stake_amount: number;
  potential_winnings: number;
  status: MatchBetStatus;
  result?: string;
  settled_at?: Date;
  team_name?: string;
  session_name?: string;
  runner_name?: string;
  game_id?: string;
  event_id?: string;
  sid?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MatchBetUser {
  id: string;
  username: string;
  name: string;
}

interface MatchBetMatch {
  id: string;
  eventName: string;
  eventTime: Date;
  seriesName: string;
  gameId: string;
  eventId: string;
  inplay: boolean;
  status: string;
  declared: boolean;
  wonby: string;
  teams: [string];
}

