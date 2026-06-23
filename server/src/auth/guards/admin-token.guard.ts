import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
@Injectable()
export class AdminTokenGuard implements CanActivate {
    private readonly JWT_SECRET: string;
    constructor() {
        this.JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
        if (!this.JWT_SECRET) {
            throw new Error('ADMIN_JWT_SECRET or JWT_SECRET must be set for admin authentication');
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
