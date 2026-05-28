import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { FootballService } from './football.service';
import { FootballEvent, FootballEventType, MatchLiveUpdate, OddsUpdate, BettingPoolStats, LiveMatchManager, } from './types/football-live.types';
@Injectable()
export class FootballLiveService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(FootballLiveService.name);
    private liveMatches: Map<string, LiveMatchManager> = new Map();
    private eventCache: Map<string, FootballEvent[]> = new Map();
    private updateIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
    constructor(private readonly prisma: PrismaService, private readonly eventsGateway: EventsGateway, private readonly footballService: FootballService) { }
    async onModuleInit() {
        this.logger.log('Initializing FootballLiveService...');
        await this.initializeLiveMatches();
    }
    onModuleDestroy() {
        this.logger.log('Destroying FootballLiveService - cleaning up timers...');
        for (const [matchId, interval] of this.updateIntervals) {
            clearInterval(interval);
        }
        this.updateIntervals.clear();
        this.liveMatches.clear();
    }
    private async initializeLiveMatches() {
        try {
            const matches = await this.prisma.footballMatch.findMany({
                where: {
                    OR: [
                        { status: 'LIVE' },
                        { status: 'HALFTIME' },
                        {
                            status: 'UPCOMING',
                            scheduledAt: {
                                gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                                lte: new Date(Date.now() + 48 * 60 * 60 * 1000),
                            },
                        },
                    ],
                },
            });
            this.logger.log(`Loaded ${matches.length} potential live matches`);
            for (const match of matches) {
                this.registerLiveMatch(match.id);
            }
        }
        catch (error) {
            this.logger.warn(`Failed to initialize live matches: ${error}`);
        }
    }
    public registerLiveMatch(matchId: string) {
        if (!this.liveMatches.has(matchId)) {
            this.liveMatches.set(matchId, {
                matchId,
                fixtureId: parseInt(matchId.split('-')[1]),
                isLive: true,
                lastUpdate: new Date(),
            });
            this.updateMatchData(matchId);
            const interval = setInterval(() => {
                this.updateMatchData(matchId);
            }, 30000);
            this.updateIntervals.set(matchId, interval);
            this.logger.log(`Registered live match: ${matchId}`);
        }
    }
    public unregisterLiveMatch(matchId: string) {
        const interval = this.updateIntervals.get(matchId);
        if (interval) {
            clearInterval(interval);
            this.updateIntervals.delete(matchId);
        }
        this.liveMatches.delete(matchId);
        this.eventCache.delete(matchId);
        this.logger.log(`Unregistered live match: ${matchId}`);
    }
    private async updateMatchData(matchId: string) {
        try {
            const match = await this.prisma.footballMatch.findUnique({
                where: { id: matchId },
            });
            if (!match) {
                this.unregisterLiveMatch(matchId);
                return;
            }
            if (match.status === 'FINISHED' || match.status === 'CANCELLED') {
                this.unregisterLiveMatch(matchId);
                return;
            }
            const manager = this.liveMatches.get(matchId);
            if (!manager)
                return;
            const scoreChanged = manager.lastScore?.home !== match.homeScore || manager.lastScore?.away !== match.awayScore;
            const elapsedChanged = manager.lastElapsed !== match.elapsed;
            const liveUpdate: MatchLiveUpdate = {
                matchId: match.id,
                fixtureId: match.fixtureId,
                status: match.status as any,
                elapsed: match.elapsed,
                homeScore: match.homeScore,
                awayScore: match.awayScore,
                homeTeam: {
                    id: match.homeTeamId,
                    name: match.homeTeamName,
                    logo: match.homeTeamLogo || '',
                },
                awayTeam: {
                    id: match.awayTeamId,
                    name: match.awayTeamName,
                    logo: match.awayTeamLogo || '',
                },
                league: match.league,
                venue: match.venue,
                scheduledAt: match.scheduledAt,
                updatedAt: new Date(),
            };
            if (scoreChanged || elapsedChanged) {
                this.eventsGateway.emitMatchLiveUpdate(liveUpdate);
                manager.lastScore = { home: match.homeScore, away: match.awayScore };
                manager.lastElapsed = match.elapsed;
            }
            const oddsUpdate: OddsUpdate = {
                matchId: match.id,
                fixtureId: match.fixtureId,
                homeOdds: match.homeOdds,
                drawOdds: match.drawOdds,
                awayOdds: match.awayOdds,
                updatedAt: new Date(),
            };
            this.eventsGateway.emitOddsUpdate(oddsUpdate);
            const bettingStats: BettingPoolStats = {
                matchId: match.id,
                fixtureId: match.fixtureId,
                homeBetPool: match.homeBetPool,
                drawBetPool: match.drawBetPool,
                awayBetPool: match.awayBetPool,
                homeBetCount: 0,
                drawBetCount: 0,
                awayBetCount: 0,
                totalPool: match.homeBetPool + match.drawBetPool + match.awayBetPool,
                updatedAt: new Date(),
            };
            this.eventsGateway.emitBettingStatsUpdate(bettingStats);
            manager.lastUpdate = new Date();
        }
        catch (error: any) {
            this.logger.error(`Failed to update match data for ${matchId}: ${error.message}`);
        }
    }
    public async addEvent(matchId: string, event: Omit<FootballEvent, 'id'>) {
        try {
            const eventId = `${matchId}-${Date.now()}`;
            const fullEvent: FootballEvent = {
                id: eventId,
                ...event,
            };
            if (!this.eventCache.has(matchId)) {
                this.eventCache.set(matchId, []);
            }
            this.eventCache.get(matchId)!.push(fullEvent);
            this.eventsGateway.emitFootballEvent(fullEvent);
            if (event.type === 'GOAL' || event.type === 'OWN_GOAL') {
                await this.updateMatchOdds(matchId);
            }
            this.logger.debug(`Added event [${event.type}] for match ${matchId} by ${event.player.name}`);
        }
        catch (error: any) {
            this.logger.error(`Failed to add event to ${matchId}: ${error.message}`);
        }
    }
    public getMatchEvents(matchId: string): FootballEvent[] {
        return this.eventCache.get(matchId) || [];
    }
    public clearMatchEvents(matchId: string) {
        this.eventCache.delete(matchId);
    }
    private async updateMatchOdds(matchId: string) {
        try {
            const match = await this.prisma.footballMatch.findUnique({
                where: { id: matchId },
            });
            if (!match)
                return;
            const scoreDiff = match.homeScore - match.awayScore;
            const baseHomeOdds = 2.0;
            const baseDrawOdds = 3.2;
            const baseAwayOdds = 2.0;
            let homeOdds = baseHomeOdds;
            let drawOdds = baseDrawOdds;
            let awayOdds = baseAwayOdds;
            if (scoreDiff > 0) {
                homeOdds *= 0.95;
                awayOdds *= 1.1;
            }
            else if (scoreDiff < 0) {
                awayOdds *= 0.95;
                homeOdds *= 1.1;
            }
            const totalPool = match.homeBetPool + match.drawBetPool + match.awayBetPool;
            if (totalPool > 0) {
                const homeRatio = match.homeBetPool / totalPool;
                const drawRatio = match.drawBetPool / totalPool;
                const awayRatio = match.awayBetPool / totalPool;
                if (homeRatio > 0.4)
                    homeOdds *= 0.98;
                if (drawRatio > 0.4)
                    drawOdds *= 0.98;
                if (awayRatio > 0.4)
                    awayOdds *= 0.98;
            }
            await this.prisma.footballMatch.update({
                where: { id: matchId },
                data: {
                    homeOdds: Math.round(homeOdds * 100) / 100,
                    drawOdds: Math.round(drawOdds * 100) / 100,
                    awayOdds: Math.round(awayOdds * 100) / 100,
                },
            });
        }
        catch (error: any) {
            this.logger.warn(`Failed to update odds for ${matchId}: ${error.message}`);
        }
    }
    public getAllLiveMatches(): string[] {
        return Array.from(this.liveMatches.keys());
    }
    public isMatchLive(matchId: string): boolean {
        return this.liveMatches.has(matchId);
    }
    @Cron(CronExpression.EVERY_MINUTE)
    async syncLiveMatches() {
        try {
            const liveMatches = await this.prisma.footballMatch.findMany({
                where: {
                    status: { in: ['LIVE', 'HALFTIME'] },
                },
            });
            for (const match of liveMatches) {
                if (!this.liveMatches.has(match.id)) {
                    this.registerLiveMatch(match.id);
                }
            }
            const liveMatchIds = new Set(liveMatches.map(m => m.id));
            for (const matchId of this.liveMatches.keys()) {
                if (!liveMatchIds.has(matchId)) {
                    this.unregisterLiveMatch(matchId);
                }
            }
        }
        catch (error: any) {
            this.logger.warn(`Failed to sync live matches: ${error.message}`);
        }
    }
}
