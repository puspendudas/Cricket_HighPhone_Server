
import { IsEnum, IsMongoId, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateWalletHistoryDto {
    @IsMongoId({ message: 'Please provide a valid User-ID' })
    public user_id: string;

    @IsMongoId({ message: 'Please provide a valid Receiver User-ID' })
    @IsOptional()
    public receiver_id: string;

    @IsPositive()
    @IsNumber({}, { message: 'amount must be a number' })
    public amount: number;

    @IsEnum(["Debit", "Credit", "None"])
    public type: string;

    @IsEnum(["success", "failed", "pending"])
    public status: string;

    @IsString()
    @IsOptional()
    public note?: string;

    @IsString()
    @IsOptional()
    public user_type?: string;

    @IsMongoId({ message: 'Please provide a valid Agent-ID or Admin-ID' })
    @IsOptional()
    public agent_id?: string;

}


export class GetWalletHistoryDto {
    @IsString()
    @IsOptional()
    public skip?: string;

    @IsString()
    public id: string;

    @IsString()
    public user_type: string;

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
    public count?: number;

    constructor() {
        this.skip = "0";
    }
}
