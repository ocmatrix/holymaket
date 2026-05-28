import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
@Injectable()
export class AdminTokenGuard implements CanActivate {
    private readonly logger = new Logger(AdminTokenGuard.name);
    private readonly ADMIN_SECRET: string | undefined;
    private readonly JWT_SECRET: string;
    private readonly isProduction: boolean;
    constructor() {
        this.isProduction = process.env.NODE_ENV === 'production';
        this.ADMIN_SECRET = process.env.ADMIN_TOKEN || process.env.ADMIN_SECRET;
        this.JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'admin-fallback-secret-change-me';
        if (!this.ADMIN_SECRET && this.isProduction) {
            this.logger.error('ADMIN_TOKEN not set in production!');
        }
    }
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const jwtToken = request.cookies?.['admin-session'];
        if (jwtToken) {
            try {
                const payload = jwt.verify(jwtToken, this.JWT_SECRET) as any;
                if (payload?.adminId) {
                    request.adminUser = { id: payload.adminId, username: payload.username, role: payload.role };
                    return true;
                }
            }
            catch {
            }
        }
        const token = request.headers['x-admin-token'];
        if (token && this.ADMIN_SECRET && token === this.ADMIN_SECRET) {
            return true;
        }
        const authHeader = request.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
            const bearerToken = authHeader.slice(7);
            try {
                const payload = jwt.verify(bearerToken, this.JWT_SECRET) as any;
                if (payload?.adminId) {
                    request.adminUser = { id: payload.adminId, username: payload.username, role: payload.role };
                    return true;
                }
            }
            catch {
            }
        }
        throw new UnauthorizedException('Admin authentication required');
    }
}
