// matchBet.dto.ts

import 'reflect-metadata';
import { IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min, Max, IsBoolean } from 'class-validator';
import { MatchBetType } from '@/interfaces/matchBet.interface';

/**
 * DTO for creating a new match bet
 */
export class CreateMatchBetDto {
  @IsMongoId({ message: 'Please provide a valid User ID' })
  @IsOptional()
  public user_id?: string;

  @IsMongoId({ message: 'Please provide a valid Match ID' })
  public match_id: string;

  @IsEnum(MatchBetType, { message: 'Please provide a valid bet type (BOOKMAKER or FANCY)' })
  public bet_type: MatchBetType;

  @IsString({ message: 'Selection must be a string' })
  public selection: string; // Back/Lay for BOOKMAKER, Yes/Not for FANCY

  @IsNumber({}, { message: 'Selection ID must be a number' })
  @IsOptional()
  public selection_id?: number; // For BOOKMAKER bets

  @IsString({ message: 'Market ID must be a string' })
  @IsOptional()
  public market_id?: string; // For FANCY bets

  @IsString({ message: 'Odds value must be a string' })
  @IsOptional()
  public odds_value?: string; // For FANCY bets (b1/l1 value)

  @IsString({ message: 'Odds rate must be a string' })
  public odds_rate: string; // Rate from bookMakerOdds or fancyOdds

  @IsNumber({}, { message: 'Stake amount must be a number' })
  @Min(1, { message: 'Stake amount must be at least 1' })
  @Max(1000000, { message: 'Stake amount cannot exceed 1,000,000' })
  public stake_amount: number;

  @IsMongoId({ message: 'Please provide a valid Agent ID' })
  @IsOptional()
  public agent_id?: string;

  @IsString({ message: 'Team name must be a string' })
  @IsOptional()
  public team_name?: string; // For BOOKMAKER bets

  @IsString({ message: 'Session name must be a string' })
  @IsOptional()
  public session_name?: string; // For FANCY bets

  @IsString({ message: 'Runner name must be a string' })
  @IsOptional()
  public runner_name?: string; // For FANCY bets

  @IsString({ message: 'Game ID must be a string' })
  @IsOptional()
  public game_id?: string;

  @IsString({ message: 'Event ID must be a string' })
  @IsOptional()
  public event_id?: string;

  @IsNumber({}, { message: 'SID must be a number' })
  @IsOptional()
  public sid?: number; // For FANCY bets

  @IsNumber({}, { message: 'Min stake must be a number' })
  @IsOptional()
  public min_stake?: number; // For FANCY bets

  @IsNumber({}, { message: 'Max stake must be a number' })
  @IsOptional()
  public max_stake?: number; // For FANCY bets

  @IsOptional()
  public bet_metadata?: any; // Additional betting data
}


/**
 * DTO for settling a bet
 */
export class SettleBetDto {
  @IsBoolean({ message: 'Is won must be a boolean' })
  @IsOptional()
  public isWon?: boolean;

  @IsNumber({}, { message: 'SID must be a number' })
  public sid: number;

  @IsString({ message: 'Team must be a string' })
  public team: string;

  @IsString({ message: 'Result must be a string' })
  @IsOptional()
  public result?: string;
}

export class CancelBetDto {
  @IsNumber({}, { message: 'SID must be a number' })
  public sid: number;
}

export class SettleFancyBetDto {
  @IsBoolean({ message: 'Is won must be a boolean' })
  @IsOptional()
  public isWon?: boolean;

  @IsNumber({}, { message: 'SID must be a number' })
  public sid: number;

  @IsNumber({}, { message: 'Run must be a number' })
  public run: number;

  @IsMongoId({ message: 'fancyId must be a MongoId' })
  public fancyId: string;

  @IsString({ message: 'Result must be a string' })
  @IsOptional()
  public result?: string;
}

export class CancelFancyBetDto {
  @IsBoolean({ message: 'Is won must be a boolean' })
  @IsOptional()
  public isWon?: boolean;

  @IsNumber({}, { message: 'SID must be a number' })
  public sid: number;

  @IsMongoId({ message: 'fancyId must be a MongoId' })
  public fancyId: string;

}
