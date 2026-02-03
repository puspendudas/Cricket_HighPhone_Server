import { TRANSACTION_STATUS, TRANSACTION_TRANSFER_TYPES, TRANSACTION_TYPES } from '@/config';
import { IsEnum, IsMongoId, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateTransactionDto {
    @IsMongoId({ message: 'Please provide a valid User-ID' })
    public user_id: string;

    @IsMongoId({ message: 'Please provide a valid Receiver User-ID' })
    @IsOptional()
    public receiver_id: string;

    @IsPositive()
    @IsNumber({}, { message: 'amount must be a number' })
    public amount: number;

    @IsEnum(TRANSACTION_TYPES)
    public type: string;

    @IsEnum(TRANSACTION_TRANSFER_TYPES)
    @IsString()
    public transfer_type: string;

    @IsMongoId({ message: 'Please provide a valid Agent-ID or Admin-ID' })
    @IsOptional()
    public agent_id: string;

    @IsString()
    @IsOptional()
    public note?: string;

    @IsString()
    @IsOptional()
    public withdraw_type?: string;
    
    @IsEnum(TRANSACTION_STATUS)
    @IsOptional()
    public status?: string;

    @IsMongoId({ message: 'Please provide a valid Market-ID' })
    @IsOptional()
    public market_id?: string;

    @IsString()
    @IsOptional()
    public tax_id: string;

    @IsString()
    @IsOptional()
    public ref_id: string;

    @IsNumber()
    @IsOptional()
    public prev_balance: number;

    @IsNumber()
    @IsOptional()
    public current_balance: number;

    @IsMongoId({ message: 'Please provide a valid Bet-ID' })
    @IsOptional()
    public bet_id: string;

}

export class CreateTransactionAgentDto {
    @IsMongoId({ message: 'Please provide a valid User-ID' })
    @IsOptional()
    public user_id: string;

    @IsMongoId({ message: 'Please provide a valid Receiver User-ID' })
    @IsOptional()
    public receiver_id: string;

    @IsPositive()
    @IsNumber({}, { message: 'amount must be a number' })
    public amount: number;

    @IsEnum(TRANSACTION_TYPES)
    public type: string;

    @IsEnum(TRANSACTION_TRANSFER_TYPES)
    @IsString()
    public transfer_type: string;

    @IsMongoId({ message: 'Please provide a valid Agent-ID or Admin-ID' })
    public agent_id: string;

    @IsString()
    @IsOptional()
    public note?: string;

    @IsString()
    @IsOptional()
    public withdraw_type?: string;
    
    @IsEnum(TRANSACTION_STATUS)
    @IsOptional()
    public status?: string;

    @IsMongoId({ message: 'Please provide a valid Market-ID' })
    @IsOptional()
    public market_id?: string;

    @IsString()
    @IsOptional()
    public tax_id: string;

    @IsString()
    @IsOptional()
    public ref_id: string;

    @IsNumber()
    @IsOptional()
    public prev_balance: number;

    @IsNumber()
    @IsOptional()
    public current_balance: number;

    @IsMongoId({ message: 'Please provide a valid Bet-ID' })
    @IsOptional()
    public bet_id: string;

}

export class SwitchTransactionDto {
    @IsMongoId({ message: 'Please provide a valid ID' })
    public id: string;

    @IsPositive()
    @IsOptional()
    public amount?: number;

    @IsString()
    @IsOptional()
    public note?: string;

    @IsString()
    @IsOptional()
    public receipt?: string;

    @IsEnum(TRANSACTION_STATUS)
    @IsOptional()
    public status: string;

    @IsMongoId({ message: 'Please provide a valid Agent-ID or Admin-ID' })
    @IsOptional()
    public approved_by?: string;
}

export class GetAllTransactionDto {
    @IsString()
    @IsOptional()
    public skip?: string;

    @IsString()
    @IsOptional()
    public query_date?: string;

    @IsString()
    @IsOptional()
    public status?: string;

    @IsString()
    @IsOptional()
    public type?: string;

    @IsString()
    @IsOptional()
    public user_id?: string;

    @IsString()
    @IsOptional()
    public agent_id?: string;

    @IsString()
    @IsOptional()
    public bet_id?: string;

    @IsString()
    @IsOptional()
    public market_id?: string;

    @IsString()
    @IsOptional()
    public transfer_type?: string;

    @IsString()
    @IsOptional()
    public count?: number;

    constructor() {
        this.skip = "0";
    }
}

export class GetUserTransactionDto {
    @IsString()
    @IsOptional()
    public skip?: string;

    @IsString()
    @IsOptional()
    public from_date?: string;

    @IsString()
    @IsOptional()
    public to_date?: string;

    @IsString()
    @IsOptional()
    public status?: string;

    @IsString()
    @IsOptional()
    public type?: string;

    @IsString()
    @IsOptional()
    public user_id?: string;

    @IsString()
    @IsOptional()
    public bet_id?: string;

    @IsString()
    @IsOptional()
    public market_id?: string;

    @IsString()
    @IsOptional()
    public transfer_type?: string;

    @IsString()
    @IsOptional()
    public count?: number;

    constructor() {
        this.skip = "0";
    }
}