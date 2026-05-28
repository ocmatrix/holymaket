import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface AIProvider {
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
}

export interface MarketContext {
    indexType: string;
    currentPrice: number;
    priceHistory: { value: number; timestamp: Date }[];
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    volatility: number;
    timeframe: string;
    signals: string[];
    technicalData: {
        rsi: string;
        macd: string;
        bb: { upper: string; lower: string };
    };
}

export interface AIAnalysisResult {
    analysis: string;
    confidence: number;
    recommendation: 'LONG' | 'SHORT' | 'HOLD';
    reasoning: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    timestamp: Date;
    aiPersona?: string;
}

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);

    constructor(private prisma: PrismaService) {
        this.logger.log('AIService (stub mode)');
    }

    getStatus() {
        return { ok: true, mode: 'stub', provider: 'none' };
    }

    getLandingSuggestion(_language: string, _fresh: boolean) {
        return { text: '样品演示：未连接外部 AI。', cached: true };
    }

    async getMarketContext(marketId: string): Promise<MarketContext> {
        const market = await this.prisma.market.findUnique({ where: { id: marketId } });
        const indexType = market?.category || 'C10';
        const timeframe = market?.timeframe || '1H';
        const last = await this.prisma.marketIndex.findFirst({
            where: { type: indexType },
            orderBy: { timestamp: 'desc' },
        });
        return {
            indexType,
            currentPrice: last?.value || 0,
            priceHistory: [],
            trend: 'NEUTRAL',
            volatility: 0,
            timeframe,
            signals: ['stub'],
            technicalData: {
                rsi: '50',
                macd: '0',
                bb: { upper: '0', lower: '0' },
            },
        };
    }

    async analyzeMarket(_marketId: string, _language: string = 'en'): Promise<AIAnalysisResult> {
        return {
            analysis: 'AI stub: no external model.',
            confidence: 0.5,
            recommendation: 'HOLD',
            reasoning: ['stub'],
            riskLevel: 'MEDIUM',
            timestamp: new Date(),
            aiPersona: 'stub',
        };
    }

    async chat(_userId: string, _question: string, _ctx?: { marketId?: string }) {
        return { reply: '样品演示：AI 问答已关闭。', stub: true };
    }

    async generateBattleStrategy(_personality: string, _context: MarketContext) {
        return { strategy: 'stub', lines: ['样品演示：无对战策略生成。'] };
    }
}
