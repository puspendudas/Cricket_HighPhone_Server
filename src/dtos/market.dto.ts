import { GAME_TYPES } from '@/config';
import { IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';

export class CreateMarketDto {
    @IsString()
    public name: string;

    @IsString()
    public name_hindi: string;

    @ValidateIf((o) => o.tag !== 'galidisawar')
    @IsString()
    @IsNotEmpty({ message: 'open_time is required when tag is others!!' })
    public open_time: string;

    @IsString()
    public close_time: string;

    @IsEnum(GAME_TYPES)
    @IsString()
    @IsOptional()
    public tag: string;
}

export class UpdateMarketDto {
    @IsMongoId({ message: 'Please provide a valid ID' })
    public id: string;

    @IsString()
    @IsOptional()
    public name: string;

    @IsString()
    @IsOptional()
    public name_hindi: string;

    @IsString()
    @IsOptional()
    public open_time: string;

    @IsString()
    @IsOptional()
    public close_time: string;
}

export class UpdateMarketOffDto {

    @IsMongoId({ message: 'Please provide a valid ID' })
    public id: string;

    @IsString()
    public toggle: string;
}

export class GetAllMarketDto {
    @IsMongoId({ message: 'Please provide a valid ID' })
    @IsOptional()
    public _id: string;

    @IsString()
    @IsOptional()
    public name: string;

    @IsString()
    @IsOptional()
    public tag: string;

    @IsNumber()
    @IsOptional()
    public skip: number;

    @IsNumber()
    @IsOptional()
    public count: number;

}

export class ToggleMarketDto {
    @IsMongoId({ message: 'Please provide a valid ID' })
    public id: string;
}

export class DeclareResultDto {
    @IsString()
    public market_id: string;

    @IsString()
    public session: string;

    @IsString()
    public panna: string;

    @IsString()
    public digit: string;

    @IsString()
    public result_date: string;

    @IsString()
    public bet_status: string;

    @IsString()
    public tag: string;
}

export class DeclareResultGaliDto {
    @IsString()
    public market_id: string;

    @IsString()
    public left_digit: string;

    @IsString()
    public right_digit: string;

    @IsString()
    public result_date: string;

    @IsString()
    public bet_status: string;

    @IsString()
    public tag: string;
}

export class GetResultsDto {
    @IsString()
    @IsOptional()
    public market_id?: string;

    @IsString()
    @IsOptional()
    public session?: string;

    @IsString()
    @IsOptional()
    public tag?: string;

    @IsNumber()
    @IsOptional()
    public skip?: number;

    @IsNumber()
    @IsOptional()
    public count?: number;

    @IsString()
    @IsOptional()
    public market_name?: string;

    @IsString()
    @IsOptional()
    public from?: string;
}

export class DeleteResultDto {
    @IsMongoId({ message: 'Please provide a valid ID' })
    public result_id?: string;

    @IsString()
    @IsOptional()
    public session?: string;
}

export class TotalDataDto {
    @IsString()
    @IsOptional()
    public market_tag?: string;

    @IsString()
    @IsOptional()
    public market_id?: string;
}

export class TodayDataDto {
    @IsString()
    @IsOptional()
    public query_date?: string;

    @IsString()
    @IsOptional()
    public market_tag?: string;

    @IsString()
    @IsOptional()
    public market_id?: string;
}

export class GetMarketDto {
    @IsMongoId({ message: 'Please provide a valid ID' })
    public market_id?: string;

    @IsString()
    public query_date?: string;
}

export class GetResultMarketDto {
    @IsString()
    @IsOptional()
    public name?: string;

    @IsString()
    @IsOptional()
    public tag?: string;

    @IsString()
    @IsOptional()
    public query_date?: string;

    @IsString()
    @IsOptional()
    public status?: string;
}