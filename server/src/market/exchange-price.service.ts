import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';

const STUB_SYMBOL_PRICES: Record<string, number> = {
    BTC: 97000,
    ETH: 3500,
    SOL: 180,
    BNB: 600,
    LINK: 15,
    ADA: 0.45,
    AVAX: 35,
    DOT: 7,
    MATIC: 0.5,
    UNI: 8,
};

@Injectable()
export class ExchangePriceService {
    private readonly logger = new Logger(ExchangePriceService.name);

    async fetchBinancePrice(symbol: string): Promise<number> {
        return STUB_SYMBOL_PRICES[symbol] ?? 100;
    }

    async fetchOKXPrice(symbol: string): Promise<number> {
        return STUB_SYMBOL_PRICES[symbol] ?? 100;
    }

    async fetchMultiplePrices(symbols: string[]): Promise<Map<string, number>> {
        const prices = new Map<string, number>();
        for (const s of symbols) {
            prices.set(s, STUB_SYMBOL_PRICES[s] ?? 100);
        }
        return prices;
    }

    async fetchGoldPrice(): Promise<number> {
        return 2700;
    }

    async calculateC10Index(weights: Map<string, number>): Promise<{
        value: number;
        components: Array<{
            symbol: string;
            price: number;
            weight: number;
            contribution: number;
        }>;
    }> {
        let weightedSum = new Decimal(0);
        const components: Array<{
            symbol: string;
            price: number;
            weight: number;
            contribution: number;
        }> = [];
        for (const [symbol, weight] of weights.entries()) {
            const price = STUB_SYMBOL_PRICES[symbol] ?? 100;
            const wv = new Decimal(price).mul(weight);
            weightedSum = weightedSum.add(wv);
            components.push({
                symbol,
                price,
                weight: weight * 100,
                contribution: wv.toNumber(),
            });
        }
        return { value: weightedSum.toDecimalPlaces(6).toNumber(), components };
    }

    clearCache() {}
}
