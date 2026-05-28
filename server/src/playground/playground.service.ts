import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { MarketOutcome } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { QuestService } from '../quest/quest.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class PlaygroundService {
    private readonly logger = new Logger(PlaygroundService.name);
    private rateLimits = new Map<string, number>();

    constructor(
        private prisma: PrismaService,
        private questService: QuestService,
        private eventsGateway: EventsGateway,
    ) {}

    async getAgents(userId?: string) {
        const agents = await this.prisma.agent.findMany();
        if (!userId || userId === 'undefined') {
            return agents;
        }
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, pts: true, totalWins: true, totalBattles: true },
        });
        if (!user) {
            return agents;
        }
        const totalWins = user.totalWins || 0;
        const userPts = user.pts || 0;
        return agents.map((agent) => {
            let isLocked = false;
            let requirement = '';
            if (agent.level === 'MEDIUM' && totalWins < 10) {
                isLocked = true;
                requirement = `Need 10 wins to unlock (${totalWins}/10)`;
            }
            else if (agent.level === 'HARD' && (totalWins < 30 || userPts < 5000)) {
                isLocked = true;
                requirement = `Need 30 wins and 5000 PTS`;
            }
            else if (agent.level === 'MASTER' && (totalWins < 100 || userPts < 20000)) {
                isLocked = true;
                requirement = `Need 100 wins and 20000 PTS`;
            }
            return { ...agent, isLocked, requirement };
        });
    }

    async startBattle(
        userId: string,
        agentId: string,
        userPick: MarketOutcome,
        language: string = 'en',
        amount: number = 0,
    ) {
        if (!userId || userId === 'undefined') {
            throw new BadRequestException('Invalid User ID');
        }
        const now = Date.now();
        const lastRequest = this.rateLimits.get(userId) || 0;
        if (now - lastRequest < 1000) {
            throw new BadRequestException('Too many requests. Please wait 1s.');
        }
        this.rateLimits.set(userId, now);

        if (amount > 0) {
            throw new BadRequestException('样品演示：对战不扣/不加积分，请使用 0 押注');
        }

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
        if (!agent) {
            throw new NotFoundException('Agent not found');
        }

        const agentPick = Math.random() > 0.5 ? MarketOutcome.YES : MarketOutcome.NO;
        const marketResult = Math.random() > 0.5 ? MarketOutcome.YES : MarketOutcome.NO;
        const userCorrect = userPick === marketResult;
        const agentCorrect = agentPick === marketResult;
        let winner: string;
        if (userCorrect && !agentCorrect) {
            winner = 'USER';
        }
        else if (!userCorrect && agentCorrect) {
            winner = 'AGENT';
        }
        else {
            winner = 'DRAW';
        }

        const agentReasoning = '样品模式：无 AI/难度/技术指标逻辑';
        const emotionalComment =
            language === 'zh-TW' ? '（演示）' : '(demo)';

        const activeMarket = await this.prisma.market.findFirst({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
        });

        const [season, tournament] = await Promise.all([
            this.prisma.season.findFirst({ where: { status: 'ACTIVE' } }),
            this.prisma.tournament.findFirst({
                where: { status: 'ACTIVE' },
                orderBy: { prizePool: 'desc' },
            }),
        ]);

        const battle = await this.prisma.battle.create({
            data: {
                userId,
                agentId,
                userPick,
                agentPick,
                amount: 0,
                reward: 0,
                winner,
                reasoning: `${agentReasoning}\n${emotionalComment}`,
                status: 'COMPLETED',
                marketType: activeMarket?.category,
                timeframe: activeMarket?.timeframe,
                userStrategy: `${userPick === 'YES' ? 'LONG' : 'SHORT'} (demo)`,
                agentStrategy: `${agentPick === 'YES' ? 'LONG' : 'SHORT'} (demo)`,
                technicalData: null,
                priceChange: null,
                seasonId: season?.id,
                tournamentId: tournament?.id,
                isPublic: true,
            },
            include: { agent: true },
        });

        await this.prisma.user.update({
            where: { id: userId },
            data: { totalBattles: { increment: 1 }, totalWins: winner === 'USER' ? { increment: 1 } : undefined },
        });

        await this.questService.updateProgress(userId, 'BATTLE');
        this.eventsGateway.emitBattleResult(userId, battle);
        const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { pts: true } });
        if (u != null) {
            this.eventsGateway.emitBalanceUpdate(userId, u.pts);
        }
        this.eventsGateway.server.emit('liveBattle:completed', {
            battleId: battle.id,
            username: user.username || 'Anonymous',
            agentName: agent.name,
            winner,
            amount: 0,
            reward: 0,
        });

        this.logger.log(`startBattle demo: user=${userId} winner=${winner}`);
        return battle;
    }

    async getRecentBattles(userId: string, limit?: number) {
        const battles = await this.prisma.battle.findMany({
            where: { userId },
            include: { agent: true },
            orderBy: { timestamp: 'desc' },
            take: limit ?? 10,
        });
        return battles.map((b) => {
            const priceChange = b.priceChange != null ? Number(b.priceChange) : null;
            const marketResult = priceChange != null ? (priceChange >= 0 ? 'YES' : 'NO') : null;
            return { ...b, marketResult };
        });
    }

    async getBattleStats(userId: string) {
        const battles = await this.prisma.battle.findMany({
            where: { userId },
            select: { winner: true, amount: true, reward: true },
        });
        const totalBattles = battles.length;
        const wins = battles.filter((b) => b.winner === 'USER').length;
        const losses = battles.filter((b) => b.winner === 'AGENT').length;
        const draws = battles.filter((b) => b.winner === 'DRAW').length;
        const totalWagered = battles.reduce((sum, b) => sum + Number(b.amount || 0), 0);
        const totalReward = battles.reduce((sum, b) => sum + Number(b.reward || 0), 0);
        const netProfit = totalReward - totalWagered;
        const winRate = totalBattles > 0 ? ((wins / totalBattles) * 100).toFixed(1) : '0';
        const roi = totalWagered > 0 ? ((netProfit / totalWagered) * 100).toFixed(1) : '0';
        return {
            totalBattles,
            wins,
            losses,
            draws,
            winRate,
            totalWagered,
            totalReward,
            netProfit,
            roi,
        };
    }
}
