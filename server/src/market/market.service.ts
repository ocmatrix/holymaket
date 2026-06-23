import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { MarketStatus, MarketOutcome } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { QuestService } from '../quest/quest.service';
import { EventsGateway } from '../events/events.gateway';
import { IndexService } from './index.service';
import { MarketChainService } from './market-chain.service';
@Injectable()
export class MarketService implements OnModuleInit {
    private readonly logger = new Logger(MarketService.name);
    private readonly PLATFORM_FEE_RATE = 0.05;
    private readonly categories = ['C10', 'GOLD'];
    private readonly timeframes = [
        { label: '10M', minutes: 10 },
        { label: '30M', minutes: 30 },
        { label: '1H', minutes: 60 },
        { label: '12H', minutes: 720 },
        { label: '24H', minutes: 1440 }
    ];
    constructor(private prisma: PrismaService, private questService: QuestService, private eventsGateway: EventsGateway, 
    @Inject(forwardRef(() => IndexService))
    private indexService: IndexService,
    private marketChainService: MarketChainService) { }
    async onModuleInit() {
        this.logger.log('MarketService (样品): 自动创建市场，无真实结算派彩');
        await this.checkAndCreateMarkets();
    }
    @Cron(CronExpression.EVERY_MINUTE)
    async handleMarketMaintenance() {
        await this.checkAndCreateMarkets();
    }
    async checkAndCreateMarkets() {
        for (const category of this.categories) {
            for (const tf of this.timeframes) {
                const activeMarket = await this.prisma.market.findFirst({
                    where: { category, timeframe: tf.label, status: MarketStatus.ACTIVE }
                });
                if (!activeMarket) {
                    const now = new Date();
                    const endTime = new Date(now.getTime() + tf.minutes * 60 * 1000);
                    const lockTime = new Date(endTime.getTime() - 10 * 1000);
                    const currentIndex = await this.prisma.marketIndex.findFirst({
                        where: { type: category },
                        orderBy: { timestamp: 'desc' }
                    });
                    const startPrice = currentIndex?.value || 0;
                    const indexService = this.prisma as any;
                    const components = await this.getCurrentComponents(category);
                    const market = await this.prisma.market.create({
                        data: {
                            title: `${category} Index [${tf.label} Round]`,
                            category,
                            timeframe: tf.label,
                            status: MarketStatus.ACTIVE,
                            endTime: endTime,
                            lockTime: lockTime,
                            resolutionTime: new Date(endTime.getTime() + 60 * 1000),
                            poolSize: 0,
                            startPrice: startPrice,
                            aiPrediction: `Generating signals for ${category} ${tf.label}...`
                        }
                    });
                    await this.createSnapshot(market.id, 'START', startPrice, components);
                }
            }
        }
    }
    private async getCurrentComponentsForSnapshot(category: string): Promise<Record<string, number>> {
        try {
            if (category === 'GOLD') {
                const goldComponents = this.indexService.getGoldComponents();
                if (goldComponents && goldComponents.length > 0) {
                    return goldComponents.reduce((acc: Record<string, number>, comp: any) => {
                        acc[comp.symbol] = comp.price;
                        return acc;
                    }, {});
                }
                const goldIndex = await this.prisma.marketIndex.findFirst({
                    where: { type: 'GOLD' },
                    orderBy: { timestamp: 'desc' }
                });
                return { 'XAU': goldIndex?.value || 0 };
            }
            const components = this.indexService.getComponents();
            if (components && components.length > 0) {
                return components.reduce((acc: Record<string, number>, comp: any) => {
                    acc[comp.symbol] = comp.price;
                    return acc;
                }, {});
            }
            this.logger.warn(`[SNAPSHOT] No component cache available for ${category}, returning empty prices`);
            const weights = await this.prisma.indexWeight.findMany({
                where: { category, isActive: true }
            });
            return weights.reduce((acc: Record<string, number>, w) => {
                acc[w.symbol] = 0;
                return acc;
            }, {});
        }
        catch (error) {
            this.logger.error(`[SNAPSHOT] Failed to get components for ${category}: ${error.message}`);
            return {};
        }
    }
    private async getCurrentComponents(category: string): Promise<Record<string, number>> {
        return this.getCurrentComponentsForSnapshot(category);
    }
    private async getCurrentIndexValue(category: string): Promise<number> {
        const index = await this.prisma.marketIndex.findFirst({
            where: { type: category },
            orderBy: { timestamp: 'desc' }
        });
        return index?.value || 0;
    }
    async createSnapshot(marketId: string, snapshotType: 'START' | 'END' | 'SETTLEMENT', indexValue: number, components: Record<string, number>, formulaParams?: Record<string, any>) {
        return this.prisma.marketSnapshot.create({
            data: {
                marketId,
                snapshotType,
                indexValue,
                components: components as any,
                formulaParams: formulaParams as any,
            }
        });
    }
    async createAdminMarket(category: string, timeframe: string, title: string, durationMinutes: number) {
        const now = new Date();
        const endTime = new Date(now.getTime() + durationMinutes * 60 * 1000);
        const lockTime = new Date(Math.max(now.getTime(), endTime.getTime() - 10 * 1000));
        const startPrice = await this.getCurrentIndexValue(category);
        const components = await this.getCurrentComponents(category);
        const chainMarket = await this.marketChainService.createMarket({
            title,
            durationMinutes,
        });
        const market = await this.prisma.market.create({
            data: {
                title,
                category,
                timeframe,
                status: MarketStatus.ACTIVE,
                endTime,
                lockTime,
                resolutionTime: new Date(endTime.getTime() + 60 * 1000),
                poolSize: Number(chainMarket.initialCollateral) / Math.pow(10, chainMarket.collateralDecimals),
                startPrice,
                aiPrediction: 'On-chain market managed by admin',
            }
        });
        await this.createSnapshot(market.id, 'START', startPrice, components, {
            chainMarketId: chainMarket.chainMarketId,
            chainMarketAddress: chainMarket.chainMarketAddress,
            chainTxHash: chainMarket.txHash,
            collateralAddress: chainMarket.collateralAddress,
            collateralDecimals: chainMarket.collateralDecimals,
            initialCollateral: chainMarket.initialCollateral,
            initialPriceYesBps: chainMarket.initialPriceYesBps,
            startTime: chainMarket.startTime,
            endTime: chainMarket.endTime,
        });
        return {
            ...market,
            chainMarket,
        };
    }
    async findAll() {
        const markets = await this.prisma.market.findMany({
            where: { status: MarketStatus.ACTIVE },
            orderBy: { createdAt: 'desc' }
        });
        return Promise.all(markets.map(async (market) => {
            const odds = await this.getMarketOdds(market.id);
            return {
                ...market,
                ...odds,
            };
        }));
    }
    async getPublicStats() {
        const activeUsers = await this.prisma.user.count({
            where: {
                bets: { some: {} }
            }
        });
        const activeMarkets = await this.prisma.market.findMany({
            where: { status: MarketStatus.ACTIVE }
        });
        const totalTVL = activeMarkets.reduce((sum, m) => sum + (m.poolSize || 0), 0);
        const totalMarkets = await this.prisma.market.count({
            where: { status: MarketStatus.ACTIVE }
        });
        const usersWithBets = await this.prisma.user.findMany({
            where: { bets: { some: {} } },
            include: {
                bets: {
                    include: { market: true }
                }
            },
            take: 100
        });
        let totalWinRate = 0;
        let validUserCount = 0;
        for (const user of usersWithBets) {
            const resolvedBets = user.bets.filter(b => b.market.status === MarketStatus.RESOLVED);
            if (resolvedBets.length > 0) {
                const wins = resolvedBets.filter(b => b.position === b.market.outcome).length;
                totalWinRate += (wins / resolvedBets.length) * 100;
                validUserCount++;
            }
        }
        const medianWinRate = validUserCount > 0 ? totalWinRate / validUserCount : 50;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const volume24h = await this.prisma.bet.aggregate({
            where: { timestamp: { gte: oneDayAgo } },
            _sum: { amount: true }
        });
        const totalBets = await this.prisma.bet.count();
        return {
            activeUsers,
            totalTVL,
            totalMarkets,
            medianWinRate: parseFloat(medianWinRate.toFixed(1)),
            volume24h: volume24h._sum.amount || 0,
            totalBets,
        };
    }
    async findResolved(category: string, timeframe: string, limit: number = 10) {
        return this.prisma.market.findMany({
            where: {
                category,
                timeframe,
                status: MarketStatus.RESOLVED
            },
            orderBy: { resolutionTime: 'desc' },
            take: limit
        });
    }
    async findRecentBets(marketId: string, limit: number = 10) {
        return this.prisma.bet.findMany({
            where: { marketId },
            include: { user: { select: { username: true, address: true } } },
            orderBy: { timestamp: 'desc' },
            take: limit
        });
    }
    async findOne(id: string) {
        const market = await this.prisma.market.findUnique({ where: { id } });
        if (!market)
            throw new NotFoundException('Market not found');
        const odds = await this.getMarketOdds(id);
        const now = new Date();
        const isLocked = market.lockTime ? now >= market.lockTime : false;
        const timeToLock = market.lockTime
            ? Math.max(0, Math.floor((market.lockTime.getTime() - now.getTime()) / 1000))
            : null;
        const timeToEnd = Math.max(0, Math.floor((market.endTime.getTime() - now.getTime()) / 1000));
        return {
            ...market,
            ...odds,
            isLocked,
            timeToLock,
            timeToEnd,
            canBet: market.status === MarketStatus.ACTIVE && !isLocked,
        };
    }
    async getMarketSnapshots(marketId: string) {
        const market = await this.prisma.market.findUnique({ where: { id: marketId } });
        if (!market)
            throw new NotFoundException('Market not found');
        const snapshots = await this.prisma.marketSnapshot.findMany({
            where: { marketId },
            orderBy: { timestamp: 'asc' }
        });
        const startSnapshot = snapshots.find(s => s.snapshotType === 'START');
        const endSnapshot = snapshots.find(s => s.snapshotType === 'END');
        let priceChange = 0;
        let priceChangePercent = 0;
        if (startSnapshot && endSnapshot) {
            const start = Number(startSnapshot.indexValue);
            const end = Number(endSnapshot.indexValue);
            priceChange = end - start;
            priceChangePercent = start > 0 ? (priceChange / start) * 100 : 0;
        }
        return {
            marketId,
            startSnapshot: startSnapshot ? {
                timestamp: startSnapshot.timestamp,
                indexValue: Number(startSnapshot.indexValue),
                components: startSnapshot.components as Record<string, number>,
                formulaParams: startSnapshot.formulaParams as Record<string, any>,
            } : null,
            endSnapshot: endSnapshot ? {
                timestamp: endSnapshot.timestamp,
                indexValue: Number(endSnapshot.indexValue),
                components: endSnapshot.components as Record<string, number>,
                formulaParams: endSnapshot.formulaParams as Record<string, any>,
            } : null,
            priceChange,
            priceChangePercent: parseFloat(priceChangePercent.toFixed(6)),
            outcome: market.outcome,
        };
    }
    async getMarketOdds(marketId: string) {
        const market = await this.prisma.market.findUnique({ where: { id: marketId } });
        if (!market) {
            throw new NotFoundException('Market not found');
        }
        return {
            marketId,
            yesPool: market.yesPool || 0,
            noPool: market.noPool || 0,
            totalPool: (market.yesPool || 0) + (market.noPool || 0),
            yesProbability: 0.5,
            noProbability: 0.5,
            yesOdds: 1,
            noOdds: 1,
            platformFeeRate: this.PLATFORM_FEE_RATE,
        };
    }
    async placeBet(_marketId: string, _userId: string, _position: MarketOutcome, _amount: number) {
        throw new BadRequestException('样品演示：预测市场下单与赔率逻辑已移除');
    }
    private async broadcastOddsUpdate(marketId: string) {
        try {
            const odds = await this.getMarketOdds(marketId);
            if (this.eventsGateway?.server) {
                this.eventsGateway.server.emit('marketOddsUpdate', {
                    marketId,
                    ...odds,
                    timestamp: new Date(),
                });
            }
        }
        catch (e) {
            this.logger.error(`Failed to broadcast odds update: ${e.message}`);
        }
    }
    async handleSettlement() {
        this.logger.debug('handleSettlement: 样品模式已禁用自动结算');
    }
    async resolveMarket(marketId: string, requestedOutcome?: MarketOutcome) {
        const market = await this.prisma.market.findUnique({ where: { id: marketId } });
        if (!market)
            throw new NotFoundException('Market not found');
        const startSnapshot = await this.prisma.marketSnapshot.findFirst({
            where: { marketId, snapshotType: 'START' },
            orderBy: { timestamp: 'asc' }
        });
        const chainMarketAddress = (startSnapshot?.formulaParams as {
            chainMarketAddress?: string;
        } | null)?.chainMarketAddress;
        if (!chainMarketAddress) {
            throw new BadRequestException('Market is not linked to an on-chain market');
        }
        const endPrice = await this.getCurrentIndexValue(market.category);
        const components = await this.getCurrentComponents(market.category);
        const normalizedOutcome = requestedOutcome || this.resolveOutcomeFromPrices(market.startPrice ? Number(market.startPrice) : 0, endPrice);
        const evidenceURI = this.buildResolutionEvidence(market.title, market.startPrice ? Number(market.startPrice) : 0, endPrice, normalizedOutcome);
        await this.createSnapshot(market.id, 'END', endPrice, components, {
            source: 'admin-resolution',
            requestedOutcome: normalizedOutcome,
        });
        const chainResolution = await this.marketChainService.resolveMarket(chainMarketAddress, normalizedOutcome === MarketOutcome.YES ? 'YES' : 'NO', evidenceURI);
        const updatedMarket = await this.prisma.market.update({
            where: { id: marketId },
            data: {
                status: MarketStatus.RESOLVED,
                outcome: normalizedOutcome,
                endPrice,
                resolutionTime: new Date(),
            }
        });
        await this.createSnapshot(market.id, 'SETTLEMENT', endPrice, components, {
            chainResolutionTxHash: chainResolution.txHash,
            chainOutcome: chainResolution.outcome,
            evidenceURI: chainResolution.evidenceURI,
        });
        return {
            ...updatedMarket,
            chainResolution,
        };
    }
    private resolveOutcomeFromPrices(startPrice: number, endPrice: number): MarketOutcome {
        if (endPrice >= startPrice) {
            return MarketOutcome.YES;
        }
        return MarketOutcome.NO;
    }
    private buildResolutionEvidence(title: string, startPrice: number, endPrice: number, outcome: MarketOutcome): string {
        const encodedTitle = encodeURIComponent(title);
        return `ipfs://xmarket/resolution?title=${encodedTitle}&start=${startPrice}&end=${endPrice}&outcome=${outcome.toLowerCase()}`;
    }
    async getAiAnalysis(marketId: string) {
        return {
            marketId,
            recommendation: 'HOLD',
            confidence: 0.5,
            signals: ['stub'],
            technicalData: {
                rsi: '50.00',
                macd: '0.0000',
                bb: { upper: '0.00', lower: '0.00' },
            },
            analysis: 'Market AI analysis stub (no indicators).',
            timestamp: new Date(),
        };
    }
}
