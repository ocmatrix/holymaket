import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { RoundStatus } from '@prisma/client';
import { MarketCalendarService } from '../market/market-calendar.service';
import { AMMService } from '../amm/amm.service';

export interface RoundConfig {
    ROUND_DURATION: number;
    BETTING_WINDOW: number;
    LOCK_PERIOD: number;
    MIN_BET: number;
    MAX_BET: number;
    PAYOUT_RATIO: number;
    PLATFORM_FEE: number;
    MIN_PRICE_CHANGE: number;
}

const DEFAULT_CONFIG: RoundConfig = {
    ROUND_DURATION: 10,
    BETTING_WINDOW: 7,
    LOCK_PERIOD: 3,
    MIN_BET: 10,
    MAX_BET: 1000,
    PAYOUT_RATIO: 1.95,
    PLATFORM_FEE: 0.05,
    MIN_PRICE_CHANGE: 0.0001,
};

const GOLD_CONFIG: Partial<RoundConfig> = {
    MIN_PRICE_CHANGE: 0.000001,
};

@Injectable()
export class RoundService implements OnModuleInit {
    private readonly logger = new Logger(RoundService.name);
    private config: RoundConfig = DEFAULT_CONFIG;
    private goldConfig: RoundConfig = { ...DEFAULT_CONFIG, ...GOLD_CONFIG };

    constructor(
        private prisma: PrismaService,
        private eventsGateway: EventsGateway,
        @Inject(forwardRef(() => MarketCalendarService))
        private _marketCalendarService: MarketCalendarService,
        @Inject(forwardRef(() => AMMService))
        private ammService: AMMService,
    ) {}

    async onModuleInit() {
        this.logger.log('RoundService stub: no timers, no auto settle/lock');
        await this.loadConfig();
        await this.ensureWeights();
        for (const category of ['C10', 'GOLD']) {
            await this.ensureOneRound(category);
        }
    }

    private async loadConfig() {
        try {
            const row = await this.prisma.systemConfig.findUnique({ where: { key: 'round_config' } });
            if (row) {
                this.config = { ...DEFAULT_CONFIG, ...JSON.parse(row.value) };
            }
        }
        catch {
            this.logger.warn('Using default round config');
        }
    }

    private async ensureWeights() {
        const n = await this.prisma.indexWeight.count();
        if (n > 0) {
            return;
        }
        const c10Weights = [
            { category: 'C10', symbol: 'BTC', weight: 0.4 },
            { category: 'C10', symbol: 'ETH', weight: 0.25 },
            { category: 'C10', symbol: 'SOL', weight: 0.08 },
            { category: 'C10', symbol: 'BNB', weight: 0.07 },
            { category: 'C10', symbol: 'LINK', weight: 0.05 },
            { category: 'C10', symbol: 'ADA', weight: 0.04 },
            { category: 'C10', symbol: 'AVAX', weight: 0.04 },
            { category: 'C10', symbol: 'DOT', weight: 0.03 },
            { category: 'C10', symbol: 'MATIC', weight: 0.02 },
            { category: 'C10', symbol: 'UNI', weight: 0.02 },
        ];
        await this.prisma.indexWeight.createMany({
            data: c10Weights.map((w) => ({ ...w, isActive: true })),
        });
    }

    private async ensureOneRound(category: string) {
        const active = await this.prisma.round.findFirst({
            where: {
                category,
                status: { in: [RoundStatus.BETTING, RoundStatus.LOCKED, RoundStatus.SETTLING] },
            },
            orderBy: { roundNumber: 'desc' },
        });
        if (!active) {
            await this.createNewRound(category);
        }
    }

    async createNewRound(category: string, retryCount = 0): Promise<void> {
        await this.loadConfig();
        const lastRound = await this.prisma.round.findFirst({
            where: { category },
            orderBy: { roundNumber: 'desc' },
        });
        const newRoundNumber = (lastRound?.roundNumber || 0) + 1;
        const now = new Date();
        const duration = this.config.ROUND_DURATION || 10;
        const lockPeriod = this.config.LOCK_PERIOD || 3;
        const bettingDuration = Math.max(1, duration - lockPeriod);
        const lockTime = new Date(now.getTime() + bettingDuration * 1000);
        const endTime = new Date(now.getTime() + duration * 1000);
        const currentPrice = await this.getCurrentPrice(category);
        try {
            const round = await this.prisma.round.create({
                data: {
                    roundNumber: newRoundNumber,
                    category,
                    startTime: now,
                    lockTime,
                    endTime,
                    openPrice: currentPrice,
                    highPrice: currentPrice,
                    lowPrice: currentPrice,
                    status: RoundStatus.BETTING,
                },
            });
            try {
                await this.ammService.createPool(round.id);
            }
            catch (e: any) {
                this.logger.warn(`createPool: ${e?.message}`);
            }
            this.broadcastRoundUpdate(round);
        }
        catch (error: any) {
            if (error.code === 'P2002' && retryCount < 3) {
                await new Promise((r) => setTimeout(r, 200 * (retryCount + 1)));
                return this.createNewRound(category, retryCount + 1);
            }
            this.logger.error(`createNewRound: ${error.message}`);
        }
    }

    async lockRound(_roundId: string) {
        this.logger.log('lockRound: stub (no-op)');
    }

    async settleRound(_roundId: string) {
        this.logger.log('settleRound: stub (no-op)');
    }

    async getCurrentPrice(category: string): Promise<number> {
        if (category === 'GOLD') {
            const goldIndex = await this.prisma.marketIndex.findFirst({
                where: { type: 'GOLD' },
                orderBy: { timestamp: 'desc' },
            });
            return goldIndex?.value || 2700;
        }
        const c10Index = await this.prisma.marketIndex.findFirst({
            where: { type: 'C10' },
            orderBy: { timestamp: 'desc' },
        });
        return c10Index?.value || 27000;
    }

    async updateRoundPrice(_category: string, _price: number) {}

    async getCurrentRound(category: string) {
        const round = await this.prisma.round.findFirst({
            where: {
                category,
                status: { in: [RoundStatus.BETTING, RoundStatus.LOCKED] },
            },
            orderBy: { roundNumber: 'desc' },
        });
        if (!round) {
            return null;
        }
        const now = Date.now();
        const endTime = new Date(round.endTime).getTime();
        const lockTime = new Date(round.lockTime).getTime();
        return {
            ...round,
            countdown: Math.max(0, Math.floor((endTime - now) / 1000)),
            canBet: round.status === RoundStatus.BETTING && now < lockTime,
            timeToLock: Math.max(0, Math.floor((lockTime - now) / 1000)),
            ROUND_DURATION: this.config.ROUND_DURATION,
            LOCK_PERIOD: this.config.LOCK_PERIOD,
            PAYOUT_RATIO: this.config.PAYOUT_RATIO,
        };
    }

    async getRoundHistory(category: string, limit: number = 20) {
        return this.prisma.round.findMany({
            where: { category, status: RoundStatus.SETTLED },
            orderBy: { roundNumber: 'desc' },
            take: limit,
            select: {
                id: true,
                roundNumber: true,
                openPrice: true,
                closePrice: true,
                highPrice: true,
                lowPrice: true,
                result: true,
                longPool: true,
                shortPool: true,
                longBetCount: true,
                shortBetCount: true,
                startTime: true,
                endTime: true,
            },
        });
    }

    private broadcastRoundUpdate(round: any) {
        if (this.eventsGateway?.server) {
            this.eventsGateway.server.emit('roundUpdate', {
                id: round.id,
                category: round.category,
                roundNumber: round.roundNumber,
                status: round.status,
                openPrice: round.openPrice,
                closePrice: round.closePrice,
                highPrice: round.highPrice,
                lowPrice: round.lowPrice,
                result: round.result,
                longPool: round.longPool,
                shortPool: round.shortPool,
                longBetCount: round.longBetCount,
                shortBetCount: round.shortBetCount,
                startTime: round.startTime,
                endTime: round.endTime,
                lockTime: round.lockTime,
                ROUND_DURATION: this.config.ROUND_DURATION,
                LOCK_PERIOD: this.config.LOCK_PERIOD,
                PAYOUT_RATIO: this.config.PAYOUT_RATIO,
            });
        }
    }

    getConfig() {
        return this.config;
    }

    async getLiveFeed(category: string, limit: number = 20) {
        const ammTrades = await this.prisma.aMMTrade.findMany({
            where: { round: { category } },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { user: { select: { username: true, address: true } } },
        });
        const formattedAmm = ammTrades.map((t) => ({
            id: t.id,
            userId: t.userId,
            user: t.user,
            amount: t.amount,
            position: t.side,
            timestamp: t.createdAt,
            type: 'AMM',
            category,
        }));
        const bets = await this.prisma.bet.findMany({
            where: { market: { category } },
            orderBy: { timestamp: 'desc' },
            take: limit,
            include: { user: { select: { username: true, address: true } } },
        });
        const formattedBets = bets.map((b) => ({
            id: b.id,
            userId: b.userId,
            user: b.user,
            amount: b.amount,
            position: b.position,
            timestamp: b.timestamp,
            type: 'BET',
            category,
        }));
        return [...formattedAmm, ...formattedBets]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }

    async getGlobalActiveOrders(limit: number = 50) {
        const ammPositions = await this.prisma.position.findMany({
            where: { status: 'OPEN' },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { user: { select: { username: true, address: true } } },
        });
        const activeBets = await this.prisma.bet.findMany({
            where: { status: { in: ['PENDING', 'ACTIVE'] } },
            orderBy: { timestamp: 'desc' },
            take: limit,
            include: {
                user: { select: { username: true, address: true } },
                market: { select: { title: true, category: true } },
            },
        });
        const results = [
            ...ammPositions.map((p) => ({
                id: p.id,
                user: p.user,
                amount: p.totalCost,
                position: p.side,
                timestamp: p.createdAt,
                type: 'AMM',
                module: 'ROUND',
                title: `Round Order`,
            })),
            ...activeBets.map((b) => ({
                id: b.id,
                user: b.user,
                amount: b.amount,
                position: b.position,
                timestamp: b.timestamp,
                type: 'BET',
                module: 'MARKET',
                title: b.market.title,
            })),
        ];
        return results
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }

    async getGlobalSettledOrders(limit: number = 50) {
        const ammPositions = await this.prisma.position.findMany({
            where: { status: 'SETTLED' },
            orderBy: { settledAt: 'desc' },
            take: limit,
            include: { user: { select: { username: true, address: true } } },
        });
        const settledBets = await this.prisma.bet.findMany({
            where: { status: 'SETTLED' },
            orderBy: { settledAt: 'desc' },
            take: limit,
            include: {
                user: { select: { username: true, address: true } },
                market: { select: { title: true, category: true } },
            },
        });
        const results = [
            ...ammPositions.map((p) => ({
                id: p.id,
                user: p.user,
                amount: p.totalCost,
                payout: p.settlementPayout,
                position: p.side,
                timestamp: p.settledAt,
                type: 'AMM',
                module: 'ROUND',
                title: `Round Order`,
            })),
            ...settledBets.map((b) => ({
                id: b.id,
                user: b.user,
                amount: b.amount,
                payout: b.payout,
                position: b.position,
                timestamp: b.settledAt,
                type: 'BET',
                module: 'MARKET',
                title: b.market.title,
            })),
        ];
        return results
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }

    async updateConfig(newConfig: Partial<RoundConfig>) {
        this.config = { ...this.config, ...newConfig };
        await this.prisma.systemConfig.upsert({
            where: { key: 'round_config' },
            update: { value: JSON.stringify(this.config) },
            create: { key: 'round_config', value: JSON.stringify(this.config) },
        });
        return this.config;
    }
}
