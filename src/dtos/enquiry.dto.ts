import { IsString, IsOptional } from 'class-validator';

export class CreateEnquiryDto {
  @IsString()
  public name: string;

  @IsString()
  public mobile: string;

  @IsString()
  public message: string;

}

export class GetEnquiryDto {
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
