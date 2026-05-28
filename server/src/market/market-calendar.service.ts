import { Injectable, Logger } from '@nestjs/common';
@Injectable()
export class MarketCalendarService {
    private readonly logger = new Logger(MarketCalendarService.name);
    isMarketOpen(category: string = 'C10'): boolean {
        if (category === 'C10') {
            return true;
        }
        if (category === 'GOLD') {
            const now = new Date();
            const day = now.getDay();
            return day >= 1 && day <= 5;
        }
        return true;
    }
    checkMarketOpen(category: string = 'C10'): {
        isOpen: boolean;
        message: string;
    } {
        const isOpen = this.isMarketOpen(category);
        if (!isOpen) {
            if (category === 'GOLD') {
                return {
                    isOpen: false,
                    message: 'Gold market is closed on weekends'
                };
            }
        }
        return {
            isOpen: true,
            message: 'Market is open'
        };
    }
    getNextMarketOpen(category: string = 'C10'): Date {
        if (category === 'C10') {
            return new Date();
        }
        if (category === 'GOLD') {
            const now = new Date();
            const day = now.getDay();
            if (day === 0) {
                const nextOpen = new Date(now);
                nextOpen.setDate(now.getDate() + 1);
                nextOpen.setHours(0, 0, 0, 0);
                return nextOpen;
            }
            else if (day === 6) {
                const nextOpen = new Date(now);
                nextOpen.setDate(now.getDate() + 2);
                nextOpen.setHours(0, 0, 0, 0);
                return nextOpen;
            }
            return new Date();
        }
        return new Date();
    }
    isTradingDay(date: Date, category: string = 'C10'): boolean {
        if (category === 'C10') {
            return true;
        }
        if (category === 'GOLD') {
            const day = date.getDay();
            return day >= 1 && day <= 5;
        }
        return true;
    }
    getGoldMarketStatus() {
        const now = new Date();
        const day = now.getDay();
        const isOpen = day >= 1 && day <= 5;
        let nextChange: Date;
        let nextStatus: 'OPEN' | 'CLOSED';
        if (isOpen) {
            nextChange = new Date(now);
            const daysUntilSaturday = 6 - day;
            nextChange.setDate(now.getDate() + daysUntilSaturday);
            nextChange.setHours(0, 0, 0, 0);
            nextStatus = 'CLOSED';
        }
        else {
            nextChange = new Date(now);
            const daysUntilMonday = day === 0 ? 1 : (8 - day);
            nextChange.setDate(now.getDate() + daysUntilMonday);
            nextChange.setHours(0, 0, 0, 0);
            nextStatus = 'OPEN';
        }
        const msUntilChange = nextChange.getTime() - now.getTime();
        return {
            market: 'GOLD',
            isOpen,
            status: isOpen ? 'OPEN' : 'CLOSED',
            currentTime: now.toISOString(),
            nextStatusChange: {
                status: nextStatus,
                time: nextChange.toISOString(),
                countdown: {
                    hours: Math.floor(msUntilChange / (1000 * 60 * 60)),
                    minutes: Math.floor((msUntilChange % (1000 * 60 * 60)) / (1000 * 60)),
                    seconds: Math.floor((msUntilChange % (1000 * 60)) / 1000),
                },
            },
            tradingHours: {
                description: 'Monday to Friday, 24 hours',
                timezone: 'UTC',
            },
            message: isOpen
                ? 'Gold market is currently open for trading'
                : 'Gold market is closed on weekends',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
    }
    getAllMarketsStatus() {
        const now = new Date();
        return {
            timestamp: now.toISOString(),
            markets: {
                C10: {
                    isOpen: true,
                    status: 'OPEN',
                    message: 'Crypto market is always open (24/7)',
                },
                GOLD: this.getGoldMarketStatus(),
            },
        };
    }
    getCountdown(market: 'GOLD' | 'C10') {
        if (market === 'C10') {
            return {
                market: 'C10',
                isOpen: true,
                message: 'Crypto market never closes',
                countdown: null,
            };
        }
        const status = this.getGoldMarketStatus();
        return {
            market: 'GOLD',
            isOpen: status.isOpen,
            message: status.message,
            countdown: status.nextStatusChange.countdown,
            nextChange: status.nextStatusChange,
        };
    }
}
