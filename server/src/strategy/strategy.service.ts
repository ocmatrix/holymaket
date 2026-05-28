import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MarketOutcome } from '@prisma/client';

export interface StrategyConfig {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    trendFollowing: boolean;
    volatilityPref: 'LOW' | 'NORMAL' | 'HIGH';
    holdDuration: '10M' | '30M' | '1H' | '12H' | '24H';
    maxBetPercent: number;
    stopLoss?: number;
    takeProfit?: number;
}

export interface AISuggestionResult {
    suggestion: 'YES' | 'NO';
    confidence: number;
    reasoning: string;
    recommendedAmount: number;
    riskWarning?: string;
    signals?: string[];
    technicalData?: any;
}

@Injectable()
export class StrategyService {
    private readonly logger = new Logger(StrategyService.name);
    private readonly presetStrategies: Record<string, StrategyConfig> = {
        conservative: {
            riskLevel: 'LOW',
            trendFollowing: true,
            volatilityPref: 'LOW',
            holdDuration: '1H',
            maxBetPercent: 5,
            stopLoss: 10,
            takeProfit: 15,
        },
        balanced: {
            riskLevel: 'MEDIUM',
            trendFollowing: true,
            volatilityPref: 'NORMAL',
            holdDuration: '30M',
            maxBetPercent: 10,
            stopLoss: 20,
            takeProfit: 30,
        },
        aggressive: {
            riskLevel: 'HIGH',
            trendFollowing: false,
            volatilityPref: 'HIGH',
            holdDuration: '10M',
            maxBetPercent: 20,
            stopLoss: 30,
            takeProfit: 50,
        },
        whale: {
            riskLevel: 'EXTREME',
            trendFollowing: false,
            volatilityPref: 'HIGH',
            holdDuration: '10M',
            maxBetPercent: 50,
        },
    };

    constructor(private prisma: PrismaService) {}

    getPresetStrategies() {
        return Object.entries(this.presetStrategies).map(([key, config]) => ({
            id: key,
            name: key.charAt(0).toUpperCase() + key.slice(1),
            ...config,
        }));
    }

    async getUserStrategies(userId: string) {
        return this.prisma.userStrategy.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
        });
    }

    async saveUserStrategy(
        userId: string,
        data: {
            name: string;
            riskLevel?: string;
            trendFollowing?: boolean;
            volatilityPref?: string;
            holdDuration?: string;
            maxBetPercent?: number;
            stopLoss?: number;
            takeProfit?: number;
        },
    ) {
        return this.prisma.userStrategy.upsert({
            where: { userId_name: { userId, name: data.name } },
            create: {
                userId,
                name: data.name,
                riskLevel: data.riskLevel || 'MEDIUM',
                trendFollowing: data.trendFollowing ?? true,
                volatilityPref: data.volatilityPref || 'NORMAL',
                holdDuration: data.holdDuration || '1H',
                maxBetPercent: data.maxBetPercent || 10,
                stopLoss: data.stopLoss,
                takeProfit: data.takeProfit,
            },
            update: {
                riskLevel: data.riskLevel,
                trendFollowing: data.trendFollowing,
                volatilityPref: data.volatilityPref,
                holdDuration: data.holdDuration,
                maxBetPercent: data.maxBetPercent,
                stopLoss: data.stopLoss,
                takeProfit: data.takeProfit,
            },
        });
    }

    async deleteUserStrategy(userId: string, strategyId: string) {
        const strategy = await this.prisma.userStrategy.findUnique({
            where: { id: strategyId },
        });
        if (!strategy || strategy.userId !== userId) {
            throw new NotFoundException('Strategy not found');
        }
        return this.prisma.userStrategy.delete({ where: { id: strategyId } });
    }

    async generateSuggestion(
        userId: string,
        marketId: string,
        strategyId?: string,
        _language: string = 'en',
    ): Promise<AISuggestionResult> {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        let strategy = this.presetStrategies.balanced;
        if (strategyId && this.presetStrategies[strategyId]) {
            strategy = this.presetStrategies[strategyId];
        }
        else if (strategyId) {
            const row = await this.prisma.userStrategy.findUnique({ where: { id: strategyId } });
            if (row) {
                strategy = {
                    riskLevel: row.riskLevel as any,
                    trendFollowing: row.trendFollowing,
                    volatilityPref: row.volatilityPref as any,
                    holdDuration: row.holdDuration as any,
                    maxBetPercent: row.maxBetPercent,
                    stopLoss: row.stopLoss || undefined,
                    takeProfit: row.takeProfit || undefined,
                };
            }
        }
        const suggestion = MarketOutcome.YES;
        const confidence = 0.5;
        const reasoning = 'Strategy stub: no AI or technical model.';
        await this.prisma.aISuggestion.create({
            data: {
                userId,
                marketId,
                strategyId: strategyId || null,
                suggestion,
                confidence,
                reasoning,
            },
        });
        const recommendedAmount = Math.floor(user.pts * (strategy.maxBetPercent / 100));
        return {
            suggestion,
            confidence,
            reasoning,
            recommendedAmount,
            signals: [],
            technicalData: {
                rsi: '50',
                macd: '0',
                bb: { upper: '0', lower: '0' },
            },
        };
    }

    async generateSuggestionWithModel(
        userId: string,
        marketId: string,
        strategyId?: string,
        _modelId?: string,
        language: string = 'en',
        _customConfig?: { name: string; apiKey: string; baseUrl: string; model: string },
    ): Promise<AISuggestionResult> {
        return this.generateSuggestion(userId, marketId, strategyId, language);
    }

    async followSuggestion(_userId: string, _suggestionId: string) {
        throw new BadRequestException('样品演示：一键跟单已关闭（无真实资金逻辑）');
    }

    async getSuggestionHistory(userId: string, limit: number = 20) {
        return this.prisma.aISuggestion.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
}
