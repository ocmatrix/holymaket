import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { ExchangePriceService } from './exchange-price.service';
import Decimal from 'decimal.js';

@Injectable()
export class IndexService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(IndexService.name);
    private lastC10Value = new Decimal(27000);
    private lastGoldValue = new Decimal(2700);
    private componentsCache: any[] = [];
    private goldComponentsCache: any[] = [{ symbol: 'XAU', price: 2700 }];
    private tickInterval: NodeJS.Timeout | null = null;

    constructor(
        private prisma: PrismaService,
        private eventsGateway: EventsGateway,
        private exchangePriceService: ExchangePriceService,
    ) {
        this.logger.log('IndexService (stub mode)');
    }

    async onModuleInit() {
        this.logger.log('Index service stub: fixed prices, no oracle/exchange calls');
        await this.pushStubSnapshot();
        this.tickInterval = setInterval(() => {
            this.pushStubSnapshot().catch((e) => this.logger.warn(String(e)));
        }, 30000);
    }

    private async pushStubSnapshot() {
        try {
            const weights = await this.prisma.indexWeight.findMany({
                where: { category: 'C10', isActive: true },
            });
            const weightMap = new Map(weights.map((w) => [w.symbol, w.weight]));
            const c10 = await this.exchangePriceService.calculateC10Index(weightMap);
            if (c10.value > 0) {
                this.lastC10Value = new Decimal(c10.value);
                this.componentsCache = c10.components;
            }
            const gold = await this.exchangePriceService.fetchGoldPrice();
            this.lastGoldValue = new Decimal(gold);
            const ts = new Date();
            await this.prisma.marketIndex.createMany({
                data: [
                    { type: 'C10', value: this.lastC10Value.toDecimalPlaces(6).toNumber(), timestamp: ts },
                    { type: 'GOLD', value: this.lastGoldValue.toDecimalPlaces(6).toNumber(), timestamp: ts },
                ],
            });
        }
        catch (e: any) {
            this.logger.warn(`pushStubSnapshot: ${e?.message}`);
        }
    }

    async refreshRpcProviders() {
        return { success: true, providerCount: 0 };
    }

    @Cron('*/30 * * * * *')
    async updateIndex() {}

    onModuleDestroy() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
        }
    }

    async getHistory(type: string, limit: number = 60) {
        return this.prisma.marketIndex.findMany({
            where: { type },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }

    getComponents() {
        return this.componentsCache;
    }

    getGoldComponents() {
        return this.goldComponentsCache;
    }

    async resetHistory() {
        await this.prisma.marketIndex.deleteMany({});
        return { success: true };
    }
}
