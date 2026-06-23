import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import * as os from 'os';
import * as crypto from 'crypto';
interface LicenseData {
    valid: boolean;
    reason?: string;
    expiresAt?: Date;
    features?: Record<string, boolean>;
    daysRemaining?: number;
}
@Injectable()
export class LicenseService implements OnModuleInit {
    private readonly logger = new Logger(LicenseService.name);
    private readonly LICENSE_SERVER = process.env.LICENSE_SERVER || 'http://localhost:4000';
    private readonly LICENSE_KEY = process.env.LICENSE_KEY;
    private cachedLicense: LicenseData | null = null;
    private lastCheck: Date | null = null;
    private isLicensed = false;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    async onModuleInit() {
        if (!this.LICENSE_KEY) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('LICENSE_KEY must be configured in production');
            }
            this.logger.warn('No LICENSE_KEY configured, running in development mode');
            this.isLicensed = true;
            return;
        }
        await this.verifyLicense();
        this.startHeartbeat();
    }
    private getHardwareFingerprint(): string {
        const data = [
            os.hostname(),
            os.cpus()[0]?.model || 'unknown',
            os.platform(),
            os.arch(),
            os.totalmem().toString(),
        ].join('|');
        return crypto.createHash('sha256').update(data).digest('hex').slice(0, 32);
    }
    async verifyLicense(): Promise<boolean> {
        if (!this.LICENSE_KEY) {
            return true;
        }
        const fingerprint = this.getHardwareFingerprint();
        try {
            const timeout = parseInt(process.env.LICENSE_TIMEOUT_MS || '30000');
            const response = await axios.post(`${this.LICENSE_SERVER}/api/verify`, {
                licenseKey: this.LICENSE_KEY,
                fingerprint,
                version: '1.0.0',
                serverInfo: {
                    hostname: os.hostname(),
                    platform: os.platform(),
                    nodeVersion: process.version,
                    region: process.env.SERVER_REGION || 'unknown',
                },
            }, {
                timeout,
                validateStatus: (status) => status < 500,
            });
            if (response.data.valid) {
                this.cachedLicense = response.data;
                this.lastCheck = new Date();
                this.isLicensed = true;
                this.logger.log(`✅ License verified, expires: ${response.data.expiresAt}, ${response.data.daysRemaining} days remaining`);
                if (response.data.daysRemaining < 7) {
                    this.logger.warn(`⚠️ License expiring soon! Only ${response.data.daysRemaining} days remaining`);
                }
                return true;
            }
            else {
                this.logger.error(`❌ License validation failed: ${response.data.reason}`);
                this.handleLicenseFailure(response.data.reason);
                return false;
            }
        }
        catch (error) {
            this.logger.error(`❌ License server unreachable: ${error.message}`);
            if (this.cachedLicense && this.isWithinGracePeriod()) {
                this.logger.warn('⚠️ Using cached license (grace period)');
                return true;
            }
            this.handleLicenseFailure('NETWORK_ERROR');
            return false;
        }
    }
    private isWithinGracePeriod(): boolean {
        if (!this.lastCheck)
            return false;
        const gracePeriodHours = parseInt(process.env.GRACE_PERIOD_HOURS || '168');
        const hours = (Date.now() - this.lastCheck.getTime()) / 3600000;
        return hours < gracePeriodHours;
    }
    private handleLicenseFailure(reason: string) {
        this.isLicensed = false;
        const forceStop = process.env.LICENSE_FORCE_STOP === 'true';
        if (forceStop) {
            this.logger.error(`🛑 License validation failed (${reason}), shutting down...`);
            process.exit(1);
        }
        else {
            this.logger.warn(`⚠️ License validation failed (${reason}), running in degraded mode`);
            global['LICENSE_DEGRADED'] = true;
            global['LICENSE_FAILURE_REASON'] = reason;
        }
    }
    private startHeartbeat() {
        const intervalHours = parseInt(process.env.HEARTBEAT_INTERVAL_HOURS || '12');
        this.heartbeatInterval = setInterval(async () => {
            this.logger.debug('🔄 License heartbeat check...');
            await this.verifyLicense();
        }, intervalHours * 60 * 60 * 1000);
        this.logger.log(`📡 License heartbeat scheduled every ${intervalHours} hours`);
    }
    isValid(): boolean {
        return this.isLicensed;
    }
    hasFeature(feature: string): boolean {
        if (!this.cachedLicense?.features)
            return true;
        return this.cachedLicense.features[feature] !== false;
    }
    getLicenseInfo() {
        return {
            isLicensed: this.isLicensed,
            cachedLicense: this.cachedLicense,
            lastCheck: this.lastCheck,
            isDegraded: global['LICENSE_DEGRADED'] || false,
            failureReason: global['LICENSE_FAILURE_REASON'],
        };
    }
    onModuleDestroy() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
    }
}
