import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { verifyMessage } from 'viem';
import { QuestService } from '../quest/quest.service';
import { JwtService, TokenPair } from './jwt.service';
import { EventsGateway } from '../events/events.gateway';
import { PrivyClient } from '@privy-io/node';
@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private privyClient: PrivyClient | null = null;
    private nonces = new Map<string, {
        nonce: string;
        expires: number;
    }>();
    constructor(private prisma: PrismaService, private questService: QuestService, private jwtService: JwtService, private eventsGateway: EventsGateway) { }
    private getPrivyClient(): PrivyClient {
        if (this.privyClient) {
            return this.privyClient;
        }
        const appId = process.env.PRIVY_APP_ID;
        const appSecret = process.env.PRIVY_APP_SECRET;
        if (!appId || !appSecret) {
            throw new UnauthorizedException('Privy server verification is not configured');
        }
        this.privyClient = new PrivyClient({ appId, appSecret });
        return this.privyClient;
    }
    generateNonce(address: string) {
        const nonce = `Sign this message to login to Superoctop Hub: ${Math.floor(Math.random() * 1000000)}`;
        const expires = Date.now() + 1000 * 60 * 5;
        this.nonces.set(address.toLowerCase(), { nonce, expires });
        return nonce;
    }
    async verifySignature(address: string, signature: string): Promise<{
        user: any;
        tokens: TokenPair;
    }> {
        const addr = address.toLowerCase();
        const stored = this.nonces.get(addr);
        if (!stored || stored.expires < Date.now()) {
            throw new UnauthorizedException('Nonce expired or not found. Please request a new nonce.');
        }
        const isValid = await verifyMessage({
            address: address as `0x${string}`,
            message: stored.nonce,
            signature: signature as `0x${string}`,
        });
        if (!isValid) {
            throw new UnauthorizedException('Invalid signature');
        }
        this.nonces.delete(addr);
        let user = await this.prisma.user.findUnique({ where: { address: addr } });
        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    address: addr,
                    username: `Explorer_${addr.slice(2, 8)}`,
                    pts: 1000,
                }
            });
        }
        const tokens = this.jwtService.generateTokenPair({
            sub: user.id,
            address: user.address,
            role: user.role || 'USER',
        });
        return { user, tokens };
    }
    async verifyPrivy(data: {
        privyToken?: string;
        accessToken?: string;
        token?: string;
        referrerCode?: string;
    }): Promise<{
        user: any;
        tokens: TokenPair;
        isNewUser: boolean;
    }> {
        try {
            const { referrerCode } = data;
            const privyToken = data.privyToken || data.accessToken || data.token;
            if (!privyToken) {
                throw new UnauthorizedException('Privy access token is required');
            }
            const privyClient = this.getPrivyClient();
            const claims = await privyClient.utils().auth().verifyAccessToken(privyToken);
            const privyId = claims.user_id;
            const privyUser = await privyClient.users()._get(privyId);
            const linkedAccounts = (privyUser?.linked_accounts || []) as Array<Record<string, any>>;
            const address = linkedAccounts.find((account) => account.type === 'wallet' || account.type === 'ethereum')?.address?.toLowerCase()
                || null;
            const email = linkedAccounts.find((account) => account.type === 'email')?.address
                || linkedAccounts.find((account) => account.type === 'google_oauth')?.email
                || null;
            const twitterId = linkedAccounts.find((account) => account.type === 'twitter_oauth')?.username
                || null;
            const discordId = linkedAccounts.find((account) => account.type === 'discord_oauth')?.username
                || null;
            this.logger.log(`Verifying Privy user: ${privyId}`);
            let user = await this.prisma.user.findUnique({
                where: { privyId }
            });
            if (!user) {
                const conditions = [];
                if (address)
                    conditions.push({ address });
                if (email)
                    conditions.push({ email });
                if (twitterId)
                    conditions.push({ twitterId });
                if (discordId)
                    conditions.push({ discordId });
                if (conditions.length > 0) {
                    user = await this.prisma.user.findFirst({
                        where: { OR: conditions }
                    });
                }
            }
            let isNewUser = false;
            if (!user) {
                this.logger.log(`Creating new user for Privy ID: ${privyId}`);
                isNewUser = true;
                let referrerId = null;
                if (referrerCode) {
                    const referrer = await this.prisma.user.findUnique({
                        where: { referralCode: referrerCode }
                    });
                    if (referrer) {
                        referrerId = referrer.id;
                        this.logger.log(`User invited by: ${referrer.username} (${referrerId})`);
                    }
                }
                user = await this.prisma.user.create({
                    data: {
                        privyId,
                        address: address || null,
                        email: email || null,
                        twitterId: twitterId || null,
                        discordId: discordId || null,
                        username: twitterId || discordId || (email ? email.split('@')[0] : `Explorer_${privyId.slice(-6)}`),
                        pts: 1000,
                        referrerId,
                    }
                });
                if (referrerId) {
                    await this.prisma.user.update({
                        where: { id: referrerId },
                        data: { pts: { increment: 100 } }
                    });
                    this.logger.log(`Referral reward: +100 PTS to user ${referrerId}`);
                    await this.questService.updateProgress(referrerId, 'REFERRAL');
                }
                const allTasks = await this.prisma.task.findMany();
                if (allTasks.length > 0) {
                    await this.prisma.userTask.createMany({
                        data: allTasks.map(t => ({
                            userId: user.id,
                            taskId: t.id,
                            progress: 0,
                            status: 'IN_PROGRESS'
                        }))
                    });
                }
            }
            else {
                this.logger.log(`Syncing existing user: ${user.id}`);
                const wasAddressEmpty = !user.address;
                user = await this.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        privyId: user.privyId || privyId,
                        address: address || user.address,
                        email: email || user.email,
                        twitterId: twitterId || user.twitterId,
                        discordId: discordId || user.discordId,
                    }
                });
                if (twitterId && !user.twitterId) {
                    await this.questService.updateProgress(user.id, 'TWITTER_LINK');
                }
                if (discordId && !user.discordId) {
                    await this.questService.updateProgress(user.id, 'DISCORD_LINK');
                }
                if (wasAddressEmpty && address) {
                    await this.questService.updateProgress(user.id, 'WALLET_LINK');
                }
                this.eventsGateway.emitUserProfileUpdate(user.id, {
                    username: user.username,
                    address: user.address,
                    email: user.email,
                    twitterId: user.twitterId,
                    discordId: user.discordId,
                });
                const existingTasksCount = await this.prisma.userTask.count({
                    where: { userId: user.id }
                });
                if (existingTasksCount === 0) {
                    const allTasks = await this.prisma.task.findMany();
                    await this.prisma.userTask.createMany({
                        data: allTasks.map(t => ({
                            userId: user.id,
                            taskId: t.id,
                            progress: 0,
                            status: 'IN_PROGRESS'
                        }))
                    });
                }
            }
            await this.questService.updateProgress(user.id, 'LOGIN');
            const tokens = this.jwtService.generateTokenPair({
                sub: user.id,
                address: user.address,
                privyId: user.privyId,
                role: user.role || 'USER',
            });
            return { user, tokens, isNewUser };
        }
        catch (error) {
            this.logger.error(`CRITICAL: verifyPrivy failed: ${error.message}`, error.stack);
            throw error;
        }
    }
    async refreshToken(refreshToken: string): Promise<TokenPair> {
        return this.jwtService.refreshAccessToken(refreshToken, (id) => this.prisma.user.findUnique({ where: { id } }));
    }
    verifyToken(token: string) {
        return this.jwtService.verifyAccessToken(token);
    }
}
