import { IsString, IsOptional, IsMongoId, IsBoolean } from 'class-validator';

export class CreateNotificationDto {
  @IsBoolean()
  @IsOptional()
  public all_user?: boolean;

  @IsOptional()
  public user_id?: any;

  @IsString()
  public title: string;

  @IsString()
  public body: string;

  @IsString()
  @IsOptional()
  public url?: string;

  @IsString()
  @IsOptional()
  public link?: string;
}

export class GetNotificationDto {
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

export class ToggleNotificationDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public id: string;
}

