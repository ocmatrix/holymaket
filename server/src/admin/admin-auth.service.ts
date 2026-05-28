import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
interface LoginAttempt {
    count: number;
    lastAttempt: number;
    lockedUntil: number;
}
@Injectable()
export class AdminAuthService implements OnModuleInit {
    private readonly logger = new Logger(AdminAuthService.name);
    private readonly JWT_SECRET: string;
    private readonly JWT_EXPIRES_IN = '24h';
    private readonly MAX_ATTEMPTS = 5;
    private readonly LOCK_DURATION = 15 * 60 * 1000;
    private loginAttempts = new Map<string, LoginAttempt>();
    constructor(private prisma: PrismaService) {
        this.JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'admin-fallback-secret-change-me';
    }
    async onModuleInit() {
        try {
            const adminCount = await this.prisma.adminUser.count();
            if (adminCount === 0) {
                const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
                const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123456';
                const hash = await bcrypt.hash(defaultPassword, 12);
                await this.prisma.adminUser.create({
                    data: {
                        username: defaultUsername,
                        passwordHash: hash,
                        role: 'super_admin',
                    },
                });
                this.logger.warn(`========================================`);
                this.logger.warn(`Default admin account created:`);
                this.logger.warn(`  Username: ${defaultUsername}`);
                this.logger.warn(`  Password: ${defaultPassword}`);
                this.logger.warn(`  PLEASE CHANGE THE PASSWORD IMMEDIATELY!`);
                this.logger.warn(`========================================`);
            }
        }
        catch (error) {
            this.logger.warn('AdminUser table not ready yet, skipping default admin creation.');
        }
    }
    async validateLogin(username: string, password: string, ip: string) {
        const admin = await this.prisma.adminUser.findUnique({
            where: { username },
        });
        if (!admin || !admin.isActive) {
            return null;
        }
        const isValid = await bcrypt.compare(password, admin.passwordHash);
        if (!isValid) {
            return null;
        }
        await this.prisma.adminUser.update({
            where: { id: admin.id },
            data: {
                lastLoginAt: new Date(),
                lastLoginIp: ip,
            },
        });
        await this.logAction(admin.id, 'LOGIN', null, `Login from ${ip}`, ip);
        this.loginAttempts.delete(ip);
        const token = jwt.sign({ adminId: admin.id, username: admin.username, role: admin.role }, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN });
        return { admin, token };
    }
    async validateToken(token: string) {
        try {
            const payload = jwt.verify(token, this.JWT_SECRET) as any;
            if (!payload?.adminId)
                return null;
            const admin = await this.prisma.adminUser.findUnique({
                where: { id: payload.adminId },
                select: { id: true, username: true, role: true, isActive: true },
            });
            if (!admin || !admin.isActive)
                return null;
            return admin;
        }
        catch {
            return null;
        }
    }
    checkRateLimit(ip: string): {
        allowed: boolean;
        retryAfterSeconds?: number;
    } {
        const attempt = this.loginAttempts.get(ip);
        if (!attempt)
            return { allowed: true };
        const now = Date.now();
        if (attempt.lockedUntil > now) {
            return {
                allowed: false,
                retryAfterSeconds: Math.ceil((attempt.lockedUntil - now) / 1000),
            };
        }
        if (attempt.lockedUntil > 0 && attempt.lockedUntil <= now) {
            this.loginAttempts.delete(ip);
            return { allowed: true };
        }
        return { allowed: true };
    }
    recordFailedAttempt(ip: string) {
        const now = Date.now();
        const attempt = this.loginAttempts.get(ip) || { count: 0, lastAttempt: 0, lockedUntil: 0 };
        if (now - attempt.lastAttempt > 30 * 60 * 1000) {
            attempt.count = 0;
        }
        attempt.count++;
        attempt.lastAttempt = now;
        if (attempt.count >= this.MAX_ATTEMPTS) {
            attempt.lockedUntil = now + this.LOCK_DURATION;
            this.logger.warn(`IP ${ip} locked for ${this.LOCK_DURATION / 1000}s after ${this.MAX_ATTEMPTS} failed login attempts`);
        }
        this.loginAttempts.set(ip, attempt);
    }
    async logAction(adminId: string, action: string, target: string | null, details: string | null, ip: string | null) {
        try {
            await this.prisma.adminAuditLog.create({
                data: { adminId, action, target, details, ip },
            });
        }
        catch {
        }
    }
}
