import { Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { Request, Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
class AdminLoginDto {
    @IsString()
    @IsNotEmpty()
    username: string;
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;
}
@ApiTags('admin-auth')
@Controller('super-admin-api/auth')
export class AdminAuthController {
    private readonly logger = new Logger(AdminAuthController.name);
    constructor(private readonly authService: AdminAuthService) { }
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '管理员登录' })
    async login(
    @Body()
    dto: AdminLoginDto, 
    @Req()
    req: Request, 
    @Res({ passthrough: true })
    res: Response) {
        const ip = req.headers['x-forwarded-for'] as string || req.headers['x-real-ip'] as string || req.ip || 'unknown';
        const rateLimitCheck = this.authService.checkRateLimit(ip);
        if (!rateLimitCheck.allowed) {
            throw new BadRequestException(`Too many login attempts. Try again in ${rateLimitCheck.retryAfterSeconds} seconds.`);
        }
        const result = await this.authService.validateLogin(dto.username, dto.password, ip);
        if (!result) {
            this.authService.recordFailedAttempt(ip);
            throw new UnauthorizedException('Invalid username or password');
        }
        res.cookie('admin-session', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/',
        });
        this.logger.log(`Admin "${dto.username}" logged in from ${ip}`);
        return {
            success: true,
            admin: {
                id: result.admin.id,
                username: result.admin.username,
                role: result.admin.role,
            },
        };
    }
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '管理员登出' })
    async logout(
    @Req()
    req: Request, 
    @Res({ passthrough: true })
    res: Response) {
        res.clearCookie('admin-session', { path: '/' });
        return { success: true };
    }
    @Get('me')
    @ApiOperation({ summary: '获取当前登录管理员信息' })
    async me(
    @Req()
    req: Request) {
        const authHeader = req.headers['authorization'];
        const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
        const token = req.cookies?.['admin-session'] || bearerToken;
        if (!token) {
            throw new UnauthorizedException('Not authenticated');
        }
        const admin = await this.authService.validateToken(token as string);
        if (!admin) {
            throw new UnauthorizedException('Invalid or expired session');
        }
        return {
            success: true,
            admin: {
                id: admin.id,
                username: admin.username,
                role: admin.role,
            },
        };
    }
}
