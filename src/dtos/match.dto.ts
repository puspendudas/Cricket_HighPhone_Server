// match.dto.ts

import 'reflect-metadata'
import { IsString, IsBoolean, IsNumber, IsOptional, IsMongoId } from 'class-validator';

export class CreateMatchDto {
    @IsString()
    public gameId: string;

    @IsString()
    public marketId: string;

    @IsString()
    public eventId: string;

    @IsString()
    public eventName: string;

    @IsString()
    public eventTime: string;

    @IsBoolean()
    public status: boolean;

    @IsString()
    public seriesName: string;

    @IsString()
    public seriesId: string;
}

export class UpdateMatchMinMaxDto {
    @IsMongoId()
    public id: string;

    @IsNumber()
    public min: number;

    @IsNumber()
    public max: number;
}

export class UpdateMatchBetDelayDto {
    @IsMongoId()
    public id: string;

    @IsNumber()
    public delay: number;

    @IsOptional()
    @IsNumber()
    public min: number;

    @IsOptional()
    @IsNumber()
    public max: number;

}
