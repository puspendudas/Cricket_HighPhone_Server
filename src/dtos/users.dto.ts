import { IsString, IsMobilePhone, MaxLength, MinLength, IsOptional, IsMongoId, IsNumber, IsBoolean, ValidateIf } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MaxLength(6)
  @MinLength(4)
  @IsOptional()
  public mpin?: string;

  @IsString()
  @IsOptional()
  public password?: string;

  @IsString()
  public fcm: string;

  @IsString()
  @IsOptional()
  public referral_code?: string;

  @IsString()
  @MinLength(1)
  public user_name: string;

  @IsMobilePhone('en-IN')
  public mobile: string;

}

export class SendOtpUserDto {
  @IsMobilePhone('en-IN')
  public mobile: string;
}

export class VerifyOtpUserDto {
  @IsMobilePhone('en-IN')
  public mobile: string;

  @IsString()
  @MaxLength(6)
  @MinLength(4)
  public otp: string;
}

export class MobileLoginPinUserDto {
  @IsMobilePhone('en-IN')
  public mobile: string;

  @IsString()
  @MaxLength(4)
  @MinLength(4)
  public mpin: string;

  @IsString()
  @IsOptional()
  public fcm: string;
}

export class MobileLoginPassUserDto {
  @IsMobilePhone('en-IN')
  public mobile: string;

  @IsString()
  public password: string;

  @IsString()
  @IsOptional()
  public fcm: string;
}

export class UserNameLoginPassUserDto {
  @IsString()
  public user_name: string;

  @IsString()
  public password: string;

  @IsString()
  @IsOptional()
  public fcm: string;
}

export class ChangePasswordUserDto {
  @IsString()
  public old_password: string;

  @IsString()
  public new_password: string;
}


export class CreateClientDto {
  @IsString()
  public user_name: string;

  @IsString()
  public name: string;

  @IsString()
  public password: string;

  @IsNumber()
  public match_commission: number;

  @IsNumber()
  public session_commission: number;

  @IsNumber()
  public casino_commission: number;

  @IsMongoId({ message: 'Please provide a valid parent ID' })
  public agent_id: string;

  @IsBoolean()
  public status: boolean;

  @IsNumber()
  public wallet: number;

  @IsNumber()
  public exposure: number;

  @IsOptional()
  @IsString()
  // @IsMobilePhone('en-IN')
  public mobile: string;
}

export class UpdateUserDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public id: string;

  @IsString()
  @IsOptional()
  public fcm?: string;

  @IsString()
  @IsOptional()
  public name?: string;

  @IsString()
  public password: string;

  @IsNumber()
  public match_commission: number;

  @IsNumber()
  public session_commission: number;

  @IsNumber()
  public casino_commission: number;

  @IsOptional()
  @IsString()
  @IsMobilePhone('en-IN')
  public mobile?: string;

  @IsBoolean()
  @IsOptional()
  public status: boolean;

  // @IsString()
  // @IsOptional()
  // public house_no?: string;

  // @IsString()
  // @IsOptional()
  // public address_lane_1?: string;

  // @IsString()
  // @IsOptional()
  // public address_lane_2?: string;

  // @IsString()
  // @IsOptional()
  // public area?: string;

  // @IsString()
  // @IsOptional()
  // public pin_code?: string;

  // @IsString()
  // @IsOptional()
  // public state_id?: string;

  // @IsString()
  // @IsOptional()
  // public district_id?: string;

  // @IsString()
  // @IsOptional()
  // public address?: string;

  @IsString()
  @IsOptional()
  public bank_name?: string;

  @IsString()
  @IsOptional()
  public account_holder_name?: string;

  @IsString()
  @IsOptional()
  public account_no?: string;

  @IsString()
  @IsOptional()
  public ifsc_code?: string;

  @IsString()
  @IsOptional()
  public branch_name?: string;

  @IsString()
  @IsOptional()
  public upi_id?: string;

  @IsString()
  @IsOptional()
  public upi_number?: string;
}

export class UpdateUserRateDiffDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public userId: string;

  @IsNumber()
  public rate_diff: number;
}

export class UpdateUserMatchLockDto {

  @IsMongoId({ message: 'Please provide a valid ID' })
  public adminId: string;

  @IsOptional()
  @ValidateIf(o => !o.marketId)
  @IsMongoId({ message: 'Please provide a valid match ID' })
  public matchId?: string;

  @IsOptional()
  @ValidateIf(o => !o.matchId)
  @IsString({ message: 'Please provide a valid market ID' })
  public marketId?: string;

  @IsOptional()
  @ValidateIf(o => !o.matchId && !o.marketId)
  @IsString({ message: 'Please provide a valid mid' })
  public mid?: string;
}

export class UpdateUserAllMatchLockDto {

  @IsMongoId({ message: 'Please provide a valid ID' })
  public adminId: string;

  @IsMongoId({ message: 'Please provide a valid match ID' })
  @IsOptional()
  public matchId?: string;

  @IsOptional()
  @IsString({ message: 'Please provide a valid market ID' })
  public marketId?: string;

  @IsOptional()
  @IsString({ message: 'Please provide a valid mid' })
  public mid?: string;
}

export class UpdateUserStackDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public userId: string;

  @IsNumber()
  public stack: number;
}

export class ChangePassUserDto {
  @IsMobilePhone('en-IN')
  public mobile: string;

  @IsString()
  @MaxLength(9)
  @MinLength(6)
  public password: string;

  @IsString()
  @MaxLength(9)
  @MinLength(6)
  public old_password: string;
}

export class ChangePinUserDto {
  @IsMobilePhone('en-IN')
  public mobile: string;

  @IsString()
  @MaxLength(4)
  @MinLength(4)
  public mpin: string;

  @IsString()
  @MaxLength(4)
  @MinLength(4)
  public old_mpin: string;
}

export class ForgotPinUserDto {
  @IsMobilePhone('en-IN')
  public mobile: string;

  @IsString()
  @MaxLength(4)
  @MinLength(4)
  public mpin: string;

  @IsString()
  public otp: string
}

export class ForgotPassUserDto {
  @IsMobilePhone('en-IN')
  public mobile: string;

  @IsString()
  public password: string;

  @IsString()
  public otp: string
}

export class IDUserDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public id: string;
}

export class GetAllUserDto {
  @IsString()
  @IsOptional()
  public name?: string;

  @IsString()
  @IsOptional()
  public agent?: string;

  @IsString()
  @IsOptional()
  public status?: boolean;

  @IsString()
  @IsOptional()
  public verified?: boolean;

  @IsString()
  @IsOptional()
  public otp_verified?: boolean;

  @IsString()
  @IsOptional()
  public from?: string;

  @IsString()
  @IsOptional()
  public to?: string;

  @IsString()
  @IsOptional()
  public search?: string;

  @IsNumber()
  @IsOptional()
  public count?: number;

  @IsNumber()
  @IsOptional()
  public skip?: number;
}

export class ToggleUserDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public id: string;

  @IsString()
  public toggle: string;
}

export class ToggleUserNotiDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public id: string;

  @IsString()
  public toggle: string;
}
