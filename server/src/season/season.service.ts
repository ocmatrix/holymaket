import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events/events.gateway';
@Injectable()
export class SeasonService {
    private readonly logger = new Logger(SeasonService.name);
    constructor(private prisma: PrismaService, private eventsGateway: EventsGateway) { }
    async getActiveSeason(type?: string) {
        const where: any = { status: 'ACTIVE' };
        if (type)
            where.type = type;
        return this.prisma.season.findFirst({
            where,
            include: {
                _count: { select: { battles: true, rankings: true } }
            }
        });
    }
    async getSeasonLeaderboard(seasonId: string, limit: number = 50) {
        const rankings = await this.prisma.seasonRanking.findMany({
            where: { seasonId },
            orderBy: [{ totalPts: 'desc' }, { winRate: 'desc' }],
            take: limit,
            include: {
                user: { select: { id: true, username: true, address: true } }
            }
        });
        return rankings.map((r, index) => ({
            rank: index + 1,
            ...r
        }));
    }
    async updateSeasonRanking(userId: string, seasonId: string, isWin: boolean, ptsChange: number) {
        const existing = await this.prisma.seasonRanking.findUnique({
            where: { seasonId_userId: { seasonId, userId } }
        });
        if (existing) {
            const newWins = existing.wins + (isWin ? 1 : 0);
            const newLosses = existing.losses + (!isWin ? 1 : 0);
            const newTotal = newWins + newLosses + existing.draws;
            await this.prisma.seasonRanking.update({
                where: { id: existing.id },
                data: {
                    totalBattles: { increment: 1 },
                    wins: isWin ? { increment: 1 } : undefined,
                    losses: !isWin ? { increment: 1 } : undefined,
                    winRate: newTotal > 0 ? newWins / newTotal : 0,
                    totalPts: { increment: ptsChange }
                }
            });
        }
        else {
            await this.prisma.seasonRanking.create({
                data: {
                    seasonId,
                    userId,
                    totalBattles: 1,
                    wins: isWin ? 1 : 0,
                    losses: !isWin ? 1 : 0,
                    winRate: isWin ? 1 : 0,
                    totalPts: ptsChange
                }
            });
        }
    }
    @Cron('0 0 * * 1')
    async createWeeklySeason() {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekNumber = this.getWeekNumber(now);
        const year = now.getFullYear();
        await this.endActiveSeason('WEEKLY');
        const season = await this.prisma.season.create({
            data: {
                name: `${year} Week ${weekNumber}`,
                type: 'WEEKLY',
                startDate: weekStart,
                endDate: weekEnd,
                status: 'ACTIVE',
                prizePool: 10000,
                rewards: JSON.stringify({
                    '1st': 3000,
                    '2nd': 2000,
                    '3rd': 1000,
                    'top10': 400,
                    'top50': 100
                })
            }
        });
        this.logger.log(`Created new weekly season: ${season.name}`);
        this.eventsGateway.broadcastSystemMessage('SEASON_START', `New weekly season started: ${season.name}`);
    }
    @Cron('0 0 1 * *')
    async createMonthlySeason() {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[now.getMonth()];
        const year = now.getFullYear();
        await this.endActiveSeason('MONTHLY');
        const season = await this.prisma.season.create({
            data: {
                name: `${monthName} ${year}`,
                type: 'MONTHLY',
                startDate: monthStart,
                endDate: monthEnd,
                status: 'ACTIVE',
                prizePool: 50000,
                rewards: JSON.stringify({
                    '1st': 15000,
                    '2nd': 10000,
                    '3rd': 5000,
                    'top10': 2000,
                    'top50': 500,
                    'top100': 200
                })
            }
        });
        this.logger.log(`Created new monthly season: ${season.name}`);
        this.eventsGateway.broadcastSystemMessage('SEASON_START', `New monthly season started: ${season.name}`);
    }
    async endActiveSeason(type: string) {
        const season = await this.prisma.season.findFirst({
            where: { type, status: 'ACTIVE' }
        });
        if (season) {
            const rankings = await this.prisma.seasonRanking.findMany({
                where: { seasonId: season.id },
                orderBy: [{ totalPts: 'desc' }, { winRate: 'desc' }]
            });
            const rewards = season.rewards ? JSON.parse(season.rewards) : {};
            for (let i = 0; i < rankings.length; i++) {
                const rank = i + 1;
                let rewardAmount = 0;
                if (rank === 1)
                    rewardAmount = rewards['1st'] || 0;
                else if (rank === 2)
                    rewardAmount = rewards['2nd'] || 0;
                else if (rank === 3)
                    rewardAmount = rewards['3rd'] || 0;
                else if (rank <= 10)
                    rewardAmount = rewards['top10'] || 0;
                else if (rank <= 50)
                    rewardAmount = rewards['top50'] || 0;
                else if (rank <= 100)
                    rewardAmount = rewards['top100'] || 0;
                await this.prisma.seasonRanking.update({
                    where: { id: rankings[i].id },
                    data: { rank, rewardAmount, rewardClaimed: false }
                });
                if (rewardAmount > 0) {
                    this.eventsGateway.server.to(rankings[i].userId).emit('notification', {
                        type: 'SEASON_REWARD_AVAILABLE',
                        message: `恭喜！您在 ${season.name} 中获得第 ${rank} 名，有 ${rewardAmount} PTS 奖励可领取！`,
                        data: { seasonId: season.id, rank, rewardAmount }
                    });
                }
            }
            await this.prisma.season.update({
                where: { id: season.id },
                data: { status: 'ENDED' }
            });
            this.logger.log(`Season ended: ${season.name}, rewards calculated for ${rankings.length} players (pending claim)`);
            this.eventsGateway.broadcastSystemMessage('SEASON_END', `Season ended: ${season.name}. Claim your rewards!`);
        }
    }
    async getAllSeasons(type?: string, limit: number = 10) {
        const where: any = {};
        if (type)
            where.type = type;
        return this.prisma.season.findMany({
            where,
            orderBy: { startDate: 'desc' },
            take: limit,
            include: {
                _count: { select: { battles: true, rankings: true } }
            }
        });
    }
    async claimSeasonReward(userId: string, seasonId: string) {
        const ranking = await this.prisma.seasonRanking.findUnique({
            where: { seasonId_userId: { seasonId, userId } }
        });
        if (!ranking)
            throw new NotFoundException('Ranking not found');
        if (ranking.rewardClaimed)
            throw new BadRequestException('Reward already claimed');
        if (!ranking.rewardAmount || ranking.rewardAmount <= 0) {
            throw new BadRequestException('No reward available');
        }
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.seasonRanking.update({
                where: { id: ranking.id },
                data: { rewardClaimed: true }
            });
            const user = await tx.user.findUnique({ where: { id: userId } });
            if (!user)
                throw new NotFoundException('User not found');
            const updatedUser = await tx.user.update({
                where: { id: userId, version: user.version },
                data: {
                    pts: { increment: ranking.rewardAmount },
                    version: { increment: 1 }
                }
            });
            if (updatedUser.teamId) {
                await tx.team.update({
                    where: { id: updatedUser.teamId },
                    data: { totalPts: { increment: ranking.rewardAmount } }
                });
            }
            return updatedUser;
        });
        this.eventsGateway.emitBalanceUpdate(userId, result.pts);
        this.logger.log(`User ${userId} claimed season reward: ${ranking.rewardAmount} PTS`);
        return { success: true, amount: ranking.rewardAmount, newBalance: result.pts };
    }
    private getWeekNumber(date: Date): number {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }
    async initializeSeasons() {
        const weeklyActive = await this.getActiveSeason('WEEKLY');
        if (!weeklyActive) {
            await this.createWeeklySeason();
        }
        const monthlyActive = await this.getActiveSeason('MONTHLY');
        if (!monthlyActive) {
            await this.createMonthlySeason();
        }
    }
    async createSeason(data: {
        name: string;
        startDate: string;
        endDate: string;
        prizePool?: number;
        rewards?: any;
    }) {
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        const now = new Date();
        let status = 'UPCOMING';
        if (startDate <= now && endDate >= now) {
            status = 'ACTIVE';
        }
        else if (endDate < now) {
            status = 'ENDED';
        }
        const season = await this.prisma.season.create({
            data: {
                name: data.name,
                type: 'CUSTOM',
                startDate,
                endDate,
                status,
                prizePool: data.prizePool ?? 0,
                rewards: data.rewards ? JSON.stringify(data.rewards) : null,
            }
        });
        this.logger.log(`Admin created season: ${season.name}`);
        return season;
    }
    async updateSeason(id: string, data: {
        name?: string;
        startDate?: string;
        endDate?: string;
        prizePool?: number;
    }) {
        const season = await this.prisma.season.findUnique({ where: { id } });
        if (!season)
            throw new NotFoundException('Season not found');
        const updateData: any = {};
        if (data.name)
            updateData.name = data.name;
        if (data.startDate)
            updateData.startDate = new Date(data.startDate);
        if (data.endDate)
            updateData.endDate = new Date(data.endDate);
        if (data.prizePool !== undefined)
            updateData.prizePool = data.prizePool;
        const updated = await this.prisma.season.update({
            where: { id },
            data: updateData
        });
        this.logger.log(`Admin updated season: ${updated.name}`);
        return updated;
    }
    async deleteSeason(id: string) {
        const season = await this.prisma.season.findUnique({ where: { id } });
        if (!season)
            throw new NotFoundException('Season not found');
        await this.prisma.seasonRanking.deleteMany({ where: { seasonId: id } });
        await this.prisma.season.delete({ where: { id } });
        this.logger.log(`Admin deleted season: ${season.name}`);
        return { success: true };
    }
    async endSeason(id: string) {
        const season = await this.prisma.season.findUnique({ where: { id } });
        if (!season)
            throw new NotFoundException('Season not found');
        if (season.status === 'ENDED')
            throw new BadRequestException('Season already ended');
        const rankings = await this.prisma.seasonRanking.findMany({
            where: { seasonId: id },
            orderBy: [{ totalPts: 'desc' }, { winRate: 'desc' }]
        });
        const rewards = season.rewards ? JSON.parse(season.rewards) : {};
        for (let i = 0; i < rankings.length; i++) {
            const rank = i + 1;
            let rewardAmount = 0;
            if (rank === 1)
                rewardAmount = rewards['1st'] || 0;
            else if (rank === 2)
                rewardAmount = rewards['2nd'] || 0;
            else if (rank === 3)
                rewardAmount = rewards['3rd'] || 0;
            else if (rank <= 10)
                rewardAmount = rewards['top10'] || 0;
            else if (rank <= 50)
                rewardAmount = rewards['top50'] || 0;
            await this.prisma.seasonRanking.update({
                where: { id: rankings[i].id },
                data: { rank, rewardAmount, rewardClaimed: false }
            });
        }
        await this.prisma.season.update({
            where: { id },
            data: { status: 'ENDED' }
        });
        this.logger.log(`Admin ended season: ${season.name}`);
        this.eventsGateway.broadcastSystemMessage('SEASON_END', `Season ended: ${season.name}`);
        return { success: true, participantsRanked: rankings.length };
    }
}
