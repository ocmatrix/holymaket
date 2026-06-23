import { Transform } from 'class-transformer';
import { IsEthereumAddress, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

function trimString({ value }: { value: unknown }) {
    return typeof value === 'string' ? value.trim() : value;
}

export class VerifySignatureDto {
    @Transform(trimString)
    @IsString()
    @IsEthereumAddress()
    address: string;

    @Transform(trimString)
    @IsString()
    @IsNotEmpty()
    @MaxLength(4096)
    signature: string;
}

export class VerifyPrivyDto {
    @Transform(trimString)
    @IsString()
    @IsNotEmpty()
    @MaxLength(8192)
    privyToken: string;

    @Transform(trimString)
    @IsOptional()
    @IsString()
    @MaxLength(128)
    referrerCode?: string;
}

export class RefreshTokenDto {
    @Transform(trimString)
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(8192)
    refreshToken?: string;
}
