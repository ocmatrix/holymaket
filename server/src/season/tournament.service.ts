import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events/events.gateway';
@Injectable()
export class TournamentService {
    private readonly logger = new Logger(TournamentService.name);
    constructor(private prisma: PrismaService, private eventsGateway: EventsGateway) { }
    async getActiveTournaments() {
        return this.prisma.tournament.findMany({
            where: { status: { in: ['UPCOMING', 'ACTIVE'] } },
            orderBy: { startDate: 'asc' },
            include: {
                _count: { select: { participants: true, battles: true } }
            }
        });
    }
    async getTournamentById(id: string) {
        const tournament = await this.prisma.tournament.findUnique({
            where: { id },
            include: {
                participants: {
                    orderBy: { score: 'desc' },
                    take: 100,
                    include: {
                        user: { select: { id: true, username: true, address: true } }
                    }
                },
                _count: { select: { battles: true } }
            }
        });
        if (!tournament)
            throw new NotFoundException('Tournament not found');
        return tournament;
    }
    async joinTournament(_userId: string, _tournamentId: string) {
        throw new BadRequestException('样品演示：锦标赛报名/扣费已禁用');
    }
    async updateParticipantScore(userId: string, tournamentId: string, isWin: boolean, pointsEarned: number) {
        const participant = await this.prisma.tournamentParticipant.findUnique({
            where: { tournamentId_userId: { tournamentId, userId } }
        });
        if (!participant || participant.eliminated)
            return;
        await this.prisma.tournamentParticipant.update({
            where: { id: participant.id },
            data: {
                wins: isWin ? { increment: 1 } : undefined,
                losses: !isWin ? { increment: 1 } : undefined,
                score: { increment: pointsEarned }
            }
        });
    }
    async getTournamentLeaderboard(tournamentId: string, limit: number = 50) {
        const participants = await this.prisma.tournamentParticipant.findMany({
            where: { tournamentId, eliminated: false },
            orderBy: [{ score: 'desc' }, { wins: 'desc' }],
            take: limit,
            include: {
                user: { select: { id: true, username: true, address: true } }
            }
        });
        return participants.map((p, index) => ({
            rank: index + 1,
            ...p
        }));
    }
    @Cron('0 0 * * *')
    async createDailyChallenge() {
        const now = new Date();
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        const dateStr = now.toISOString().split('T')[0];
        const existing = await this.prisma.tournament.findFirst({
            where: {
                type: 'DAILY_CHALLENGE',
                startDate: { gte: dayStart, lte: dayEnd }
            }
        });
        if (existing)
            return;
        await this.createTournament({
            name: `Daily Challenge ${dateStr}`,
            description: 'Win as many battles as possible today!',
            type: 'DAILY_CHALLENGE',
            startDate: dayStart,
            endDate: dayEnd,
            entryFee: 100,
            prizePool: 5000,
            maxPlayers: 500,
            rewards: {
                '1st': 2000,
                '2nd': 1500,
                '3rd': 1000,
                'top10': 500
            }
        });
    }
    @Cron('0 18 * * 5')
    async createWeekendCup() {
        const now = new Date();
        const cupStart = new Date(now);
        cupStart.setHours(20, 0, 0, 0);
        const cupEnd = new Date(cupStart);
        cupEnd.setDate(cupEnd.getDate() + 2);
        cupEnd.setHours(22, 0, 0, 0);
        const weekNumber = this.getWeekNumber(now);
        await this.createTournament({
            name: `Weekend Cup #${weekNumber}`,
            description: 'The ultimate weekend showdown! Higher stakes, bigger rewards.',
            type: 'WEEKEND_CUP',
            startDate: cupStart,
            endDate: cupEnd,
            entryFee: 500,
            prizePool: 25000,
            maxPlayers: 200,
            minLevel: 'STANDARD',
            rewards: {
                '1st': 10000,
                '2nd': 6000,
                '3rd': 3000,
                'top10': 1000,
                'top20': 500
            }
        });
    }
    @Cron('*/5 * * * *')
    async checkTournamentStatus() {
        const now = new Date();
        await this.prisma.tournament.updateMany({
            where: {
                status: 'UPCOMING',
                startDate: { lte: now }
            },
            data: { status: 'ACTIVE' }
        });
        const endedTournaments = await this.prisma.tournament.findMany({
            where: {
                status: 'ACTIVE',
                endDate: { lte: now }
            }
        });
        for (const tournament of endedTournaments) {
            await this.endTournament(tournament.id);
        }
    }
    async endTournament(tournamentId: string) {
        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId }
        });
        if (!tournament || tournament.status === 'ENDED')
            return;
        const participants = await this.prisma.tournamentParticipant.findMany({
            where: { tournamentId },
            orderBy: [{ score: 'desc' }, { wins: 'desc' }]
        });
        const rewards = tournament.rewards ? JSON.parse(tournament.rewards) : {};
        for (let i = 0; i < participants.length; i++) {
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
            else if (rank <= 20)
                rewardAmount = rewards['top20'] || 0;
            else if (rank <= 50)
                rewardAmount = rewards['top50'] || 0;
            await this.prisma.tournamentParticipant.update({
                where: { id: participants[i].id },
                data: { rank, rewardAmount, rewardClaimed: false }
            });
            if (rewardAmount > 0) {
                this.eventsGateway.server.to(participants[i].userId).emit('notification', {
                    type: 'TOURNAMENT_REWARD_AVAILABLE',
                    message: `恭喜！您在 ${tournament.name} 中获得第 ${rank} 名，有 ${rewardAmount} PTS 奖励可领取！`,
                    data: { tournamentId, rank, rewardAmount }
                });
            }
        }
        await this.prisma.tournament.update({
            where: { id: tournamentId },
            data: { status: 'ENDED' }
        });
        this.logger.log(`Tournament ended: ${tournament.name}, rewards calculated for ${participants.length} players (pending claim)`);
        this.eventsGateway.broadcastSystemMessage('TOURNAMENT_END', `Tournament ended: ${tournament.name}. Claim your rewards!`);
    }
    async claimTournamentReward(userId: string, tournamentId: string) {
        const participant = await this.prisma.tournamentParticipant.findUnique({
            where: { tournamentId_userId: { tournamentId, userId } }
        });
        if (!participant)
            throw new NotFoundException('Participation not found');
        if (participant.rewardClaimed)
            throw new BadRequestException('Reward already claimed');
        if (!participant.rewardAmount || participant.rewardAmount <= 0) {
            throw new BadRequestException('No reward available');
        }
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.tournamentParticipant.update({
                where: { id: participant.id },
                data: { rewardClaimed: true }
            });
            const user = await tx.user.findUnique({ where: { id: userId } });
            if (!user)
                throw new NotFoundException('User not found');
            const updatedUser = await tx.user.update({
                where: { id: userId, version: user.version },
                data: {
                    pts: { increment: participant.rewardAmount },
                    version: { increment: 1 }
                }
            });
            if (updatedUser.teamId) {
                await tx.team.update({
                    where: { id: updatedUser.teamId },
                    data: { totalPts: { increment: participant.rewardAmount } }
                });
            }
            return updatedUser;
        });
        this.eventsGateway.emitBalanceUpdate(userId, result.pts);
        this.logger.log(`User ${userId} claimed tournament reward: ${participant.rewardAmount} PTS`);
        return { success: true, amount: participant.rewardAmount, newBalance: result.pts };
    }
    private getWeekNumber(date: Date): number {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }
    async createTournament(data: {
        name: string;
        description?: string;
        startDate: string | Date;
        endDate: string | Date;
        entryFee?: number;
        prizePool?: number;
        maxParticipants?: number;
        maxPlayers?: number;
        type?: string;
        minLevel?: string;
        rules?: any;
        rewards?: any;
    }) {
        const startDate = typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate;
        const endDate = typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate;
        const now = new Date();
        let status = 'UPCOMING';
        if (startDate <= now && endDate >= now) {
            status = 'ACTIVE';
        }
        else if (endDate < now) {
            status = 'ENDED';
        }
        const tournament = await this.prisma.tournament.create({
            data: {
                name: data.name,
                description: data.description,
                type: data.type || 'CUSTOM',
                startDate,
                endDate,
                status,
                entryFee: data.entryFee || 0,
                prizePool: data.prizePool || 0,
                maxPlayers: data.maxParticipants || data.maxPlayers || 100,
                minLevel: data.minLevel,
                rules: data.rules ? JSON.stringify(data.rules) : null,
                rewards: data.rewards ? JSON.stringify(data.rewards) : null
            }
        });
        this.logger.log(`Tournament created: ${tournament.name}`);
        this.eventsGateway.broadcastSystemMessage('TOURNAMENT_CREATED', `New tournament: ${tournament.name}`);
        return tournament;
    }
    async updateTournament(id: string, data: {
        name?: string;
        description?: string;
        startDate?: string;
        endDate?: string;
        entryFee?: number;
        prizePool?: number;
        maxParticipants?: number;
    }) {
        const tournament = await this.prisma.tournament.findUnique({ where: { id } });
        if (!tournament)
            throw new NotFoundException('Tournament not found');
        const updateData: any = {};
        if (data.name)
            updateData.name = data.name;
        if (data.description !== undefined)
            updateData.description = data.description;
        if (data.startDate)
            updateData.startDate = new Date(data.startDate);
        if (data.endDate)
            updateData.endDate = new Date(data.endDate);
        if (data.entryFee !== undefined)
            updateData.entryFee = data.entryFee;
        if (data.prizePool !== undefined)
            updateData.prizePool = data.prizePool;
        if (data.maxParticipants !== undefined)
            updateData.maxPlayers = data.maxParticipants;
        const updated = await this.prisma.tournament.update({
            where: { id },
            data: updateData
        });
        this.logger.log(`Tournament updated: ${updated.name}`);
        return updated;
    }
    async deleteTournament(id: string) {
        const tournament = await this.prisma.tournament.findUnique({ where: { id } });
        if (!tournament)
            throw new NotFoundException('Tournament not found');
        await this.prisma.tournamentParticipant.deleteMany({ where: { tournamentId: id } });
        await this.prisma.tournament.delete({ where: { id } });
        this.logger.log(`Tournament deleted: ${tournament.name}`);
        return { success: true };
    }
}
