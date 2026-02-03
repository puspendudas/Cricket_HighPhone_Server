import 'reflect-metadata';
import { GAME_MODES, GAME_TYPES, SUB_MODES } from '@/config';
import { IsEnum, IsMongoId, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateBetDto {
    @IsMongoId({ message: 'Please provide a valid User-ID' })
    public user_id: string;

    @IsString()
    @IsOptional()
    public session: string;

    @IsString()
    @IsOptional()
    public open_digit: string;

    @IsString()
    @IsOptional()
    public close_digit: string;

    @IsString()
    @IsOptional()
    public open_panna: string;

    @IsString()
    @IsOptional()
    public close_panna: string;

    @IsNumber()
    public points: number;

    @IsEnum(GAME_MODES)
    public game_mode: string;

    @IsEnum(SUB_MODES)
    @IsOptional()
    public sub_mode: string;

    @IsMongoId({ message: 'Please provide a valid Market-ID' })
    public market_id: string;

    @IsMongoId({ message: 'Please provide a valid Market-ID' })
    @IsOptional()
    public agent_id: string;

    @IsString()
    @IsOptional()
    public commission: string;

    @IsEnum(GAME_TYPES)
    @IsString()
    public tag: string;
}

export class UpdateBetDto {
    @IsMongoId({ message: 'Please provide a valid ID' })
    public id: string;

    @IsString()
    @IsOptional()
    public open_digit: string;

    @IsString()
    @IsOptional()
    public close_digit: string;

    @IsString()
    @IsOptional()
    public open_panna: string;

    @IsString()
    @IsOptional()
    public close_panna: string;
}

export class GetAllBetDto {
    @IsMongoId({ message: 'Please provide a valid ID' })
    @IsOptional()
    public user_id?: string;

    @IsMongoId({ message: 'Please provide a valid ID' })
    @IsOptional()
    public agent_id?: string;

    @IsMongoId({ message: 'Please provide a valid ID' })
    @IsOptional()
    public market_id?: string;

    @IsString()
    @IsOptional()
    public status?: string;

    @IsString()
    @IsOptional()
    public market_name?: string;

    @IsString()
    @IsOptional()
    public session?: string;

    @IsString()
    @IsOptional()
    public win?: string;

    @IsString()
    @IsOptional()
    public commission?: string;

    @IsEnum(GAME_MODES)
    @IsOptional()
    public game_mode?: string;

    @IsString()
    @IsOptional()
    public tag?: string;

    @IsString()
    @IsOptional()
    public skip?: string;

    @IsString()
    @IsOptional()
    public count?: string;

    @IsString()
    @IsOptional()
    public query_date?: string;

    @IsString()
    @IsOptional()
    public user_info?: boolean;

    constructor() {
        this.skip = "0";
    }
}

export class GetUserBetDto {
    @IsMongoId({ message: 'Please provide a valid ID' })
    public user_id?: string;

    @IsMongoId({ message: 'Please provide a valid ID' })
    @IsOptional()
    public market_id?: string;

    @IsString()
    @IsOptional()
    public game_mode?: string;

    @IsString()
    @IsOptional()
    public win?: string;

    @IsString()
    @IsOptional()
    public tag?: string;

    @IsString()
    @IsOptional()
    public from_date?: string;

    @IsString()
    @IsOptional()
    public to_date?: string;
}

export class PointsBetDto {
    @IsString()
    public market_id: string;

    @IsString()
    public session: string;

}

export class PonitsBetAllDto {
    @IsMongoId({ message: 'Please provide a valid Market-ID' })
    @IsString()
    public market_id: string;

    @IsString()
    @IsOptional()
    public session: string;

    @IsString()
    @IsOptional()
    public game_mode: string;

    @IsString()
    public query_date: string;

    @IsString()
    public tag: string;

}

export class ProfitBetDto {
    @IsString()
    @IsOptional()
    public query_date?: string;
}