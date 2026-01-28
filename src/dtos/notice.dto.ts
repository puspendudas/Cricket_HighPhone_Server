import { IsString, IsOptional, IsMongoId } from 'class-validator';

export class CreateNoticeDto {
  @IsString()
  @IsOptional()
  public title?: string;

  @IsString()
  @IsOptional()
  public body?: string;

  @IsString()
  @IsOptional()
  public button?: string;

  @IsString()
  @IsOptional()
  public url?: string;

  @IsString()
  @IsOptional()
  public link?: string;
}

export class GetNoticeDto {
    @IsString()
    @IsOptional()
    public id?: string;

    @IsString()
    @IsOptional()
    public skip?: string;

    @IsString()
    @IsOptional()
    public count?: number;

    constructor() {
        this.skip = "0";
    }
}

export class ToggleNoticeDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public id: string;
}