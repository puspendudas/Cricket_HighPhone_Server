// announcement.dto.ts
import { IsString, IsOptional, IsMongoId } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @IsOptional()
  public title?: string;

  @IsString()
  @IsOptional()
  public body?: string;

  // Only for all, admin or user is allowed
  @IsString()
  @IsOptional()
  public user_type?: string;

  @IsMongoId()
  @IsOptional()
  public match_id?: string;

  @IsString()
  @IsOptional()
  public status?: boolean;
}

export class GetAnnouncementDto {
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

export class ToggleAnnouncementDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public id: string;
}
