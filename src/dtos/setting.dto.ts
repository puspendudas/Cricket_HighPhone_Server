import { IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';


export class GlobalSettingsDto {
    @IsString()
    @IsOptional()
    public single_digit_1: string;

    @IsString()
    @IsOptional()
    public single_digit_2: string;

    @IsString()
    @IsOptional()
    public jodi_digit_1: string;

    @IsString()
    @IsOptional()
    public jodi_digit_2: string;

    @IsString()
    @IsOptional()
    public single_panna_1: string;

    @IsString()
    @IsOptional()
    public single_panna_2: string;

    @IsString()
    @IsOptional()
    public double_panna_1: string;

    @IsString()
    @IsOptional()
    public double_panna_2: string;

    @IsString()
    @IsOptional()
    public tripple_panna_1: string;

    @IsString()
    @IsOptional()
    public tripple_panna_2: string;

    @IsString()
    @IsOptional()
    public half_sangum_1: string;

    @IsString()
    @IsOptional()
    public half_sangum_2: string;

    @IsString()
    @IsOptional()
    public full_sangum_1: string;

    @IsString()
    @IsOptional()
    public full_sangum_2: string;

    @IsString()
    @IsOptional()
    public even_odd_digit_1: string;

    @IsString()
    @IsOptional()
    public even_odd_digit_2: string;

    @IsString()
    @IsOptional()
    public double_even_odd_1: string;

    @IsString()
    @IsOptional()
    public double_even_odd_2: string;
}

export class StarlineSettingsDto {
    @IsString()
    @IsOptional()
    public single_digit_1: string;

    @IsString()
    @IsOptional()
    public single_digit_2: string;

    @IsString()
    @IsOptional()
    public single_panna_1: string;

    @IsString()
    @IsOptional()
    public single_panna_2: string;

    @IsString()
    @IsOptional()
    public double_panna_1: string;

    @IsString()
    @IsOptional()
    public double_panna_2: string;

    @IsString()
    @IsOptional()
    public tripple_panna_1: string;

    @IsString()
    @IsOptional()
    public tripple_panna_2: string;

    @IsString()
    @IsOptional()
    public even_odd_digit_1: string;

    @IsString()
    @IsOptional()
    public even_odd_digit_2: string;
}

export class UpdateSettingDto {
    @IsNumber()
    @IsOptional()
    public referral_bonus: number;

    @IsNumber()
    @IsOptional()
    public joining_bonus: number;

    @IsString()
    @IsOptional()
    public merchant_name: string;

    @IsString()
    @IsOptional()
    public withdraw_open: string;

    @IsString()
    @IsOptional()
    public withdraw_close: string;

    @IsString()
    @IsOptional()
    public app_link: string;

    @IsString()
    @IsOptional()
    public web_app_link: string;

    @IsString()
    @IsOptional()
    public web_link: string;

    @IsString()
    @IsOptional()
    public share_message: string;

    @IsString()
    @IsOptional()
    public account_holder: string;

    @IsString()
    @IsOptional()
    public account_number: string;

    @IsString()
    @IsOptional()
    public account_ifsc: string;

    @IsString()
    @IsOptional()
    public google_id: string;

    @IsString()
    @IsOptional()
    public phonepe_id: string;

    @IsString()
    @IsOptional()
    public other_id: string;

    @IsString()
    @IsOptional()
    public mobile: string;

    @IsString()
    @IsOptional()
    public telegram: string;

    @IsString()
    @IsOptional()
    public whatsapp: string;

    @IsString()
    @IsOptional()
    public whatsapp_text: string;

    @IsString()
    @IsOptional()
    public landline_1: string;

    @IsString()
    @IsOptional()
    public landline_2: string;

    @IsString()
    @IsOptional()
    public email_1: string;

    @IsString()
    @IsOptional()
    public email_2: string;

    @IsString()
    @IsOptional()
    public facebook: string;

    @IsString()
    @IsOptional()
    public twitter: string;

    @IsString()
    @IsOptional()
    public youtube: string;

    @IsString()
    @IsOptional()
    public instagram: string;

    @IsString()
    @IsOptional()
    public privacy_policy: string;

    @IsString()
    @IsOptional()
    public welcome_text: string;

    @IsBoolean()
    @IsOptional()
    public upi_pay: boolean;

    @IsOptional()
    @IsBoolean()
    public qr_pay: boolean;

    @IsString()
    @IsOptional()
    public video_link: string;

    @IsString()
    @IsOptional()
    public reset_time: string;

    @IsObject()
    @IsOptional()
    public main?: string

    @IsObject()
    @IsOptional()
    public starline?: string

    @IsObject()
    @IsOptional()
    public galidisawar?: string

    @IsObject()
    @IsOptional()
    public deposit?: {
        min?: number;
        max?: number;
    };

    @IsObject()
    @IsOptional()
    public withdraw?: {
        min?: number;
        max?: number;
    };

    @IsObject()
    @IsOptional()
    public transfer?: {
        min?: number;
        max?: number;
    };

    @IsObject()
    @IsOptional()
    public betting?: {
        min?: number;
        max?: number;
    };

    @IsOptional()
    public tags?: string[];

};

export class MerchantUPIDto {
    @IsString()
    public merchant_upi: string;

    @IsString()
    public merchant_name: string;

    @IsString()
    public otp: string;
}

export class MerchantQrDto {
    @IsString()
    public otp: string;
}

export class MaintainenceDto {
    @IsBoolean()
    @IsOptional()
    public maintainence?: Boolean;

    @IsString()
    @IsOptional()
    public maintainence_msg?: string;

    @IsString()
    @IsOptional()
    public app_version?: string;

    @IsBoolean()
    @IsOptional()
    public app_version_req?: Boolean;
}

export class ToggleSettingNotiDto {
    @IsString()
    public toggle: string;
}

export class UpdateWithdrawlOffDto {
    @IsString()
    public toggle: string;
}