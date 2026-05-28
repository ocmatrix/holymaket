import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PositionSide } from '@prisma/client';
interface AMMConfig {
    INITIAL_LIQUIDITY: number;
    FEE_RATE: number;
    MIN_TRADE_AMOUNT: number;
    MAX_TRADE_AMOUNT: number;
    MIN_RESERVE_RATIO: number;
}

const DEFAULT_CONFIG: AMMConfig = {
    INITIAL_LIQUIDITY: 10000,
    FEE_RATE: 0.02,
    MIN_TRADE_AMOUNT: 1,
    MAX_TRADE_AMOUNT: 5000,
    MIN_RESERVE_RATIO: 0.01,
};

@Injectable()
export class AMMService {
    private readonly logger = new Logger(AMMService.name);
    private config: AMMConfig = DEFAULT_CONFIG;

    constructor(private prisma: PrismaService) {}

    async createPool(roundId: string, initialLiquidity?: number): Promise<any> {
        const liquidity = initialLiquidity || this.config.INITIAL_LIQUIDITY;
        const yesReserve = liquidity;
        const noReserve = liquidity;
        const kConstant = yesReserve * noReserve;
        return this.prisma.liquidityPool.create({
            data: {
                roundId,
                yesReserve,
                noReserve,
                kConstant,
                initialLiquidity: liquidity,
                yesPrice: 0.5,
                noPrice: 0.5,
            },
        });
    }

    async getPool(roundId: string) {
        return this.prisma.liquidityPool.findUnique({ where: { roundId } });
    }

    async getPrices(roundId: string): Promise<{ yesPrice: number; noPrice: number }> {
        const pool = await this.getPool(roundId);
        if (!pool) {
            return { yesPrice: 0.5, noPrice: 0.5 };
        }
        const total = pool.yesReserve + pool.noReserve;
        return {
            yesPrice: parseFloat((pool.noReserve / total).toFixed(6)),
            noPrice: parseFloat((pool.yesReserve / total).toFixed(6)),
        };
    }

    async quoteBuy(
        roundId: string,
        _side: PositionSide,
        amountIn: number,
    ): Promise<{
        sharesOut: number;
        avgPrice: number;
        priceImpact: number;
        fee: number;
        newYesPrice: number;
        newNoPrice: number;
    }> {
        const pool = await this.getPool(roundId);
        if (!pool) {
            throw new BadRequestException('Pool not found');
        }
        return {
            sharesOut: amountIn,
            avgPrice: 1,
            priceImpact: 0,
            fee: 0,
            newYesPrice: 0.5,
            newNoPrice: 0.5,
        };
    }

    async quoteSell(
        roundId: string,
        _side: PositionSide,
        _sharesIn: number,
    ): Promise<{
        amountOut: number;
        avgPrice: number;
        priceImpact: number;
        fee: number;
        newYesPrice: number;
        newNoPrice: number;
    }> {
        const pool = await this.getPool(roundId);
        if (!pool) {
            throw new BadRequestException('Pool not found');
        }
        return {
            amountOut: 0,
            avgPrice: 1,
            priceImpact: 0,
            fee: 0,
            newYesPrice: 0.5,
            newNoPrice: 0.5,
        };
    }

    async executeBuy(
        _roundId: string,
        _userId: string,
        _side: PositionSide,
        _amountIn: number,
    ): Promise<{
        success: boolean;
        shares: number;
        avgPrice: number;
        fee: number;
        position: any;
    }> {
        throw new BadRequestException('AMM trading disabled (stub implementation)');
    }

    async executeSell(
        _roundId: string,
        _userId: string,
        _side: PositionSide,
        _sharesToSell: number,
    ): Promise<{
        success: boolean;
        amountOut: number;
        avgPrice: number;
        fee: number;
        realizedPnL: number;
        position: any;
    }> {
        throw new BadRequestException('AMM trading disabled (stub implementation)');
    }

    async getUserPositions(userId: string, roundId?: string) {
        const where: any = { userId };
        if (roundId) {
            where.roundId = roundId;
        }
        return this.prisma.position.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
    }

    async settlePositions(_roundId: string, _outcome: 'YES' | 'NO' | 'DRAW') {
        this.logger.log('AMM settlePositions: stub (no-op)');
    }

    async getTrades(roundId: string, limit: number = 100) {
        return this.prisma.aMMTrade.findMany({
            where: { roundId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    async getPriceCandles(roundId: string, interval: '1s' | '5s' | '1m' = '5s', limit: number = 100) {
        return this.prisma.priceCandle.findMany({
            where: { roundId, interval },
            orderBy: { startTime: 'desc' },
            take: limit,
        });
    }

    async aggregateCandles(_roundId: string, _interval: '1s' | '5s' | '1m') {}

    getConfig() {
        return this.config;
    }
}
