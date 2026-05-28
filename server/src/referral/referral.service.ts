import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events/events.gateway';
@Injectable()
export class ReferralService {
    private readonly logger = new Logger(ReferralService.name);
    private readonly REWARDS = {
        SIGNUP_BONUS: 100,
        FIRST_BET_BONUS: 50,
        ACTIVITY_BONUS: 10,
    };
    constructor(private prisma: PrismaService, private eventsGateway: EventsGateway) { }
    async getReferralStats(userId: string) {
        const referralCount = await this.prisma.user.count({
            where: { referrerId: userId }
        });
        const totalRewards = await this.prisma.referralReward.aggregate({
            where: { referrerId: userId },
            _sum: { amount: true }
        });
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const monthlyReferrals = await this.prisma.user.count({
            where: {
                referrerId: userId,
                createdAt: { gte: startOfMonth }
            }
        });
        const monthlyRewards = await this.prisma.referralReward.aggregate({
            where: {
                referrerId: userId,
                createdAt: { gte: startOfMonth }
            },
            _sum: { amount: true }
        });
        return {
            totalReferrals: referralCount,
            totalRewards: totalRewards._sum.amount || 0,
            monthlyReferrals,
            monthlyRewards: monthlyRewards._sum.amount || 0,
            rewardRates: this.REWARDS,
        };
    }
    async getReferralList(userId: string, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;
        const [referrals, total] = await Promise.all([
            this.prisma.user.findMany({
                where: { referrerId: userId },
                select: {
                    id: true,
                    username: true,
                    address: true,
                    createdAt: true,
                    pts: true,
                    totalBattles: true,
                    totalWins: true,
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.user.count({
                where: { referrerId: userId }
            })
        ]);
        const referralsWithRewards = await Promise.all(referrals.map(async (referral) => {
            const rewards = await this.prisma.referralReward.aggregate({
                where: {
                    referrerId: userId,
                    refereeId: referral.id
                },
                _sum: { amount: true }
            });
            return {
                ...referral,
                rewardsGenerated: rewards._sum.amount || 0,
            };
        }));
        return {
            referrals: referralsWithRewards,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        };
    }
    async getRewardHistory(userId: string, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;
        const [rewards, total] = await Promise.all([
            this.prisma.referralReward.findMany({
                where: { referrerId: userId },
                include: {
                    referee: {
                        select: {
                            id: true,
                            username: true,
                            address: true,
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.referralReward.count({
                where: { referrerId: userId }
            })
        ]);
        return {
            rewards,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        };
    }
    async grantReferralReward(referrerId: string, refereeId: string, type: 'SIGNUP_BONUS' | 'FIRST_BET_BONUS' | 'ACTIVITY_BONUS', description?: string) {
        const amount = this.REWARDS[type];
        if (!amount) {
            this.logger.warn(`Unknown reward type: ${type}`);
            return null;
        }
        try {
            const reward = await this.prisma.referralReward.create({
                data: {
                    referrerId,
                    refereeId,
                    amount,
                    type,
                    description: description || `${type} reward`,
                }
            });
            const updatedUser = await this.prisma.user.update({
                where: { id: referrerId },
                data: { pts: { increment: amount } }
            });
            this.eventsGateway.emitBalanceUpdate(referrerId, updatedUser.pts);
            await this.createReferralNotification(referrerId, refereeId, amount, type);
            this.logger.log(`Referral reward granted: ${amount} PTS to ${referrerId} (type: ${type})`);
            return reward;
        }
        catch (error) {
            this.logger.error(`Failed to grant referral reward: ${error.message}`);
            return null;
        }
    }
    private async createReferralNotification(referrerId: string, refereeId: string, amount: number, type: string) {
        try {
            const referee = await this.prisma.user.findUnique({
                where: { id: refereeId },
                select: { username: true, address: true }
            });
            const refereeName = referee?.username ||
                (referee?.address ? `${referee.address.slice(0, 6)}...${referee.address.slice(-4)}` : 'Someone');
            let title = '';
            let content = '';
            switch (type) {
                case 'SIGNUP_BONUS':
                    title = 'New Referral!';
                    content = `${refereeName} joined using your referral link. You earned ${amount} PTS!`;
                    break;
                case 'FIRST_BET_BONUS':
                    title = 'Referral Bonus!';
                    content = `${refereeName} made their first bet. You earned ${amount} PTS!`;
                    break;
                case 'ACTIVITY_BONUS':
                    title = 'Activity Reward!';
                    content = `You earned ${amount} PTS from ${refereeName}'s activity.`;
                    break;
            }
            await this.prisma.notification.create({
                data: {
                    userId: referrerId,
                    type: 'REFERRAL',
                    title,
                    content,
                    data: JSON.stringify({ refereeId, amount, rewardType: type }),
                }
            });
        }
        catch (error) {
            this.logger.error(`Failed to create referral notification: ${error.message}`);
        }
    }
    async getGlobalReferralStats() {
        const totalReferrers = await this.prisma.user.count({
            where: { referrals: { some: {} } },
        });
        const totalReferrals = await this.prisma.user.count({
            where: { referrerId: { not: null } },
        });
        const totalRewards = await this.prisma.referralReward.aggregate({
            _sum: { amount: true },
        });
        return {
            totalReferrers,
            totalReferrals,
            totalRewardsIssued: totalRewards._sum.amount || 0,
        };
    }
    async getTopReferrers(limit: number = 20) {
        const users = await this.prisma.user.findMany({
            where: { referrals: { some: {} } },
            select: {
                id: true,
                username: true,
                address: true,
                pts: true,
                _count: { select: { referrals: true } },
            },
        });
        const sorted = users
            .sort((a, b) => (b._count?.referrals ?? 0) - (a._count?.referrals ?? 0))
            .slice(0, limit);
        const withRewards = await Promise.all(sorted.map(async (u) => {
            const sum = await this.prisma.referralReward.aggregate({
                where: { referrerId: u.id },
                _sum: { amount: true },
            });
            return {
                id: u.id,
                username: u.username,
                address: u.address,
                pts: u.pts,
                referralCount: u._count?.referrals ?? 0,
                totalRewards: sum._sum.amount || 0,
            };
        }));
        return withRewards;
    }
    async checkAndGrantFirstBetBonus(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { referrerId: true }
        });
        if (!user?.referrerId)
            return;
        const existingReward = await this.prisma.referralReward.findFirst({
            where: {
                referrerId: user.referrerId,
                refereeId: userId,
                type: 'FIRST_BET_BONUS'
            }
        });
        if (existingReward)
            return;
        const betCount = await this.prisma.bet.count({
            where: { userId }
        });
        if (betCount === 1) {
            await this.grantReferralReward(user.referrerId, userId, 'FIRST_BET_BONUS', 'First bet bonus for referred user');
        }
    }
}
