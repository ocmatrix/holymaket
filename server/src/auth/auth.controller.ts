import { Controller, Post, Body, Get, Param, Headers, UnauthorizedException, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { RefreshTokenDto, VerifyPrivyDto, VerifySignatureDto } from './dto/auth-request.dto';

function setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/auth',
    });
}

function clearRefreshCookie(res: Response) {
    res.clearCookie('refresh_token', { path: '/auth' });
}
@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }
    @Get('nonce/:address')
    @ApiOperation({ summary: '获取登录用的随机随机数' })
    getNonce(
    @Param('address')
    address: string) {
        return { nonce: this.authService.generateNonce(address) };
    }
    @Post('verify')
    @ApiOperation({ summary: '校验签名并登录（钱包签名登录）' })
    async verify(
    @Body()
    body: VerifySignatureDto,
    @Res({ passthrough: true })
    res: Response) {
        const { user, tokens } = await this.authService.verifySignature(body.address, body.signature);
        setRefreshCookie(res, tokens.refreshToken);
        return {
            user,
            accessToken: tokens.accessToken,
            expiresIn: tokens.expiresIn,
        };
    }
    @Post('verify-privy')
    @ApiOperation({ summary: '校验 Privy 并登录（社交登录）' })
    async verifyPrivy(
    @Body()
    body: VerifyPrivyDto,
    @Res({ passthrough: true })
    res: Response) {
        const { user, tokens, isNewUser } = await this.authService.verifyPrivy(body);
        setRefreshCookie(res, tokens.refreshToken);
        return {
            user,
            accessToken: tokens.accessToken,
            expiresIn: tokens.expiresIn,
            isNewUser: isNewUser || false,
        };
    }
    @Post('refresh')
    @ApiOperation({ summary: '刷新 Access Token' })
    async refreshToken(
    @Body()
    body: RefreshTokenDto,
    @Headers('cookie')
    cookieHeader: string | undefined,
    @Res({ passthrough: true })
    res: Response) {
        const cookieToken = cookieHeader?.split(';').map(part => part.trim()).find(part => part.startsWith('refresh_token='))?.slice('refresh_token='.length);
        const refreshToken = body.refreshToken || (cookieToken ? decodeURIComponent(cookieToken) : undefined);
        if (!refreshToken) {
            throw new UnauthorizedException('Refresh token is required');
        }
        const { user, tokens } = await this.authService.refreshToken(refreshToken);
        setRefreshCookie(res, tokens.refreshToken);
        return {
            user,
            accessToken: tokens.accessToken,
            expiresIn: tokens.expiresIn,
        };
    }
    @Post('logout')
    @ApiOperation({ summary: '退出登录' })
    async logout(
    @Res({ passthrough: true })
    res: Response) {
        clearRefreshCookie(res);
        return { success: true };
    }
    @Get('me')
    @ApiBearerAuth()
    @ApiOperation({ summary: '获取当前登录用户信息（需要 Bearer Token）' })
    async getMe(
    @Headers('authorization')
    authHeader: string) {
        if (!authHeader) {
            throw new UnauthorizedException('Authorization header required');
        }
        const token = authHeader.replace('Bearer ', '');
        const payload = this.authService.verifyToken(token);
        return { userId: payload.sub, address: payload.address, role: payload.role };
    }
}
