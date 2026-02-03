import { IsOptional, IsString } from 'class-validator';

export class SliderDto {
    @IsString()
    @IsOptional()
    public tag?: string;

    @IsString()
    @IsOptional()
    public link?: string;

}