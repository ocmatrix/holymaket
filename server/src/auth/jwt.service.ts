import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
export interface JwtPayload {
    sub: string;
    address?: string;
    privyId?: string;
    role: string;
    iat?: number;
    exp?: number;
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
@Injectable()
export class JwtService {
    private readonly logger = new Logger(JwtService.name);
    private readonly JWT_SECRET: string;
    private readonly REFRESH_SECRET: string;
    constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET;
        this.REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
        if (!this.JWT_SECRET || !this.REFRESH_SECRET) {
            throw new Error('❌ CRITICAL: JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables!\n' +
                'Please configure these in server/.env:\n' +
                '  JWT_SECRET=your-random-secret-key-at-least-32-characters\n' +
                '  JWT_REFRESH_SECRET=another-random-secret-key-at-least-32-characters');
        }
        if (this.JWT_SECRET.length < 32 || this.REFRESH_SECRET.length < 32) {
            this.logger.warn('⚠️ JWT secrets should be at least 32 characters for security');
        }
    }
    private readonly ACCESS_TOKEN_EXPIRY = '2h';
    private readonly REFRESH_TOKEN_EXPIRY = '7d';
    generateTokenPair(payload: Omit<JwtPayload, 'iat' | 'exp'>): TokenPair {
        const accessToken = jwt.sign(payload, this.JWT_SECRET, { expiresIn: this.ACCESS_TOKEN_EXPIRY });
        const refreshToken = jwt.sign({ sub: payload.sub, type: 'refresh' }, this.REFRESH_SECRET, { expiresIn: this.REFRESH_TOKEN_EXPIRY });
        this.logger.log(`Token pair generated for user: ${payload.sub}`);
        return {
            accessToken,
            refreshToken,
            expiresIn: 2 * 60 * 60,
        };
    }
    verifyAccessToken(token: string): JwtPayload {
        try {
            const decoded = jwt.verify(token, this.JWT_SECRET) as JwtPayload;
            return decoded;
        }
        catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new UnauthorizedException('Token expired. Please refresh or re-login.');
            }
            throw new UnauthorizedException('Invalid token');
        }
    }
    verifyRefreshToken(token: string): {
        sub: string;
    } {
        try {
            const decoded = jwt.verify(token, this.REFRESH_SECRET) as {
                sub: string;
                type: string;
            };
            if (decoded.type !== 'refresh') {
                throw new UnauthorizedException('Invalid refresh token');
            }
            return { sub: decoded.sub };
        }
        catch (error) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
    }
    async refreshAccessToken(refreshToken: string, getUserById: (id: string) => Promise<any>): Promise<TokenPair> {
        const { sub: userId } = this.verifyRefreshToken(refreshToken);
        const user = await getUserById(userId);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        return this.generateTokenPair({
            sub: user.id,
            address: user.address,
            privyId: user.privyId,
            role: user.role || 'USER',
        });
    }
    extractTokenFromHeader(authHeader: string): string {
        if (!authHeader) {
            throw new UnauthorizedException('No authorization header');
        }
        const [type, token] = authHeader.split(' ');
        if (type !== 'Bearer' || !token) {
            throw new UnauthorizedException('Invalid authorization header format');
        }
        return token;
    }
}
