import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BacktestService {
    private readonly logger = new Logger(BacktestService.name);

    constructor(private prisma: PrismaService) {}

    async calculateBacktestWinRate(_category: string, _timeframe: string, _lookbackPeriods: number = 100) {
        this.logger.log('calculateBacktestWinRate: 样品模式，无回测算法');
        return {
            winRate: 0,
            totalPredictions: 0,
            wins: 0,
            losses: 0,
            timeframeBreakdown: {} as Record<string, number>,
        };
    }

    async getMarketBacktestStats(marketId: string) {
        const market = await this.prisma.market.findUnique({ where: { id: marketId } });
        if (!market) {
            throw new NotFoundException('Market not found');
        }
        return this.calculateBacktestWinRate(market.category, market.timeframe);
    }
}
