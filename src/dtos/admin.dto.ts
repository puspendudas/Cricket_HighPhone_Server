import 'reflect-metadata';
import { ADMIN_TYPES } from '@/config';
import { registerDecorator, ValidationOptions, ValidationArguments, IsString, IsEnum, isMobilePhone, IsOptional, IsMongoId, IsNumber, IsBoolean, IsIn } from 'class-validator';

export class CreateAdminDto {
  @IsString()
  public user_name: string;

  @IsString()
  public name: string;

  @IsString()
  public password: string;

  @IsNumber()
  public share: number;

  @IsNumber()
  public match_commission: number;

  @IsNumber()
  public session_commission: number;

  @IsNumber()
  public casino_commission: number;

  @IsMongoId({ message: 'Please provide a valid parent ID' })
  public parent_id: string;

  @IsNumber()
  public wallet: number;

  @IsNumber()
  public exposure: number;

  @IsBoolean()
  public status: boolean;

  @IsOptional()
  @IsString()
  // @IsMobilePhone('en-IN')
  public mobile: string;

  @IsEnum(ADMIN_TYPES, { message: 'type must be one of: super_admin, admin, super_master, master, super_agent, agent' })
  public type: string;
}

export class UpdateAdminDto {

  @IsMongoId({ message: 'Please provide a valid ID' })
  public id: string;

  @IsOptional()
  @IsString()
  public name: string;

  @IsOptional()
  @IsString()
  public password: string;

  @IsOptional()
  @IsBoolean()
  public status: boolean

  @IsOptional()
  @IsNumber()
  public share: number;

  @IsOptional()
  @IsNumber()
  public match_commission: number;

  @IsOptional()
  @IsNumber()
  public session_commission: number;

  @IsOptional()
  @IsNumber()
  public casino_commission: number;

  @IsOptional()
  @IsString()
  // @IsMobilePhone('en-IN')
  public mobile: string;
}

export class UpdateAgentDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public id: string;

  @IsString()
  @IsOptional()
  public user_name: string;

  @IsString()
  @IsOptional()
  public name: string;

  @IsNumber()
  @IsOptional()
  public share: number;

  @IsNumber()
  @IsOptional()
  public match_commission: number;

  @IsNumber()
  @IsOptional()
  public session_commission: number;

  @IsNumber()
  @IsOptional()
  public casino_commission: number;

  @IsNumber()
  @IsOptional()
  public wallet: number;

  @IsNumber()
  @IsOptional()
  public exposure: number;

  @IsString()
  @IsOptional()
  public branch_name: string;

  @IsString()
  @IsOptional()
  public bank_name: string;

  @IsString()
  @IsOptional()
  public account_holder_name: string;

  @IsString()
  @IsOptional()
  public account_no: string;

  @IsString()
  @IsOptional()
  public ifsc_code: string;

  @IsString()
  @IsOptional()
  public upi_id: string;

  @IsString()
  @IsOptional()
  public upi_number: string;
}

export class UpdateByAgentDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public id: string;

  @IsString()
  @IsOptional()
  public branch_name: string;

  @IsString()
  @IsOptional()
  public bank_name: string;

  @IsString()
  @IsOptional()
  public account_holder_name: string;

  @IsString()
  @IsOptional()
  public account_no: string;

  @IsString()
  @IsOptional()
  public ifsc_code: string;

  @IsString()
  @IsOptional()
  public upi_id: string;

  @IsString()
  @IsOptional()
  public upi_number: string;
}

export class MobileLoginAdminDto {
  @IsString()
  // @Min(6, {message: 'Please provide a valid user name'})
  public user_name: string;

  @IsString()
  // @Min(6, {message: 'Please provide a valid password'})
  public password: string;
}

export class GetAllAdminDto {
  @IsString()
  @IsOptional()
  public name?: string;

  @IsString()
  @IsOptional()
  public mobile?: string;

  @IsString()
  @IsOptional()
  public type?: string;
}

export class UpdateLimitDto {
  @IsNumber()
  limit: number;   // <-- matches your JSON body

  @IsIn(["deposit", "withdrawal"])
  type: "deposit" | "withdrawal";

  @IsMongoId({ message: 'Please provide a valid ID' })
  id: string;
}

export class GetAgentDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public _id?: string;

  @IsString()
  @IsOptional()
  public name?: string;

  @IsString()
  @IsOptional()
  public mobile?: string;
}

export class ToggleAdminDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public id: string;
}

export class ToggleAllAdminDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public id: string;

  @IsBoolean()
  public status: boolean;
}

export class AdminChangePasswordDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public id: string;

  @IsString()
  public old_password: string;

  @IsString()
  public new_password: string;
}

export class AdminChangeMobileDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public id: string;

  @IsString()
  public mobile: string;

  @IsString()
  public otp: string;
}

export class AgentChangePasswordDto {
  @IsMongoId({ message: 'Please provide a valid ID' })
  public id: string;

  @IsString()
  public new_password: string;
}


export function IsMobileOrDefault(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isMobileOrDefualt',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        validate(value: any, args: ValidationArguments) {
          const defaultValue = '1234567890';
          // If the value is the default value, return true
          if (value === defaultValue) {
            return true;
          }
          // If the value is a valid mobile number, return true
          if (isMobilePhone(value, 'en-IN')) {
            return true;
          }
          return false;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid mobile number or the default value.`;
        },
      },
    });
  };
}
