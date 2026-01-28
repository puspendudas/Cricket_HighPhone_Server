// settlement.dto.ts
import { IsMongoId, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateSettlementDto {
    @IsNotEmpty()
    @IsMongoId()
    adminIdTo: string;

    @IsNotEmpty()
    @IsMongoId()
    adminIdFrom: string;

    @IsNotEmpty()
    @IsNumber()
    ammount: number;

    @IsNotEmpty()
    @IsString()
    type: string;

    @IsNotEmpty()
    @IsString()
    remark: string;
}