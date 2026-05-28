import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma.service';
import { QuestService } from '../quest/quest.service';
import { EventsGateway } from '../events/events.gateway';
import { BadRequestException } from '@nestjs/common';
interface APIFootballFixture {
    fixture: {
        id: number;
        referee: string | null;
        timezone: string;
        date: string;
        timestamp: number;
        status: {
            long: string;
            short: string;
            elapsed: number | null;
        };
        venue: {
            id: number | null;
            name: string | null;
            city: string | null;
        };
    };
    league: {
        id: number;
        name: string;
        country: string;
        logo: string;
        flag: string | null;
        season: number;
        round: string;
    };
    teams: {
        home: {
            id: number;
            name: string;
            logo: string;
            winner: boolean | null;
        };
        away: {
            id: number;
            name: string;
            logo: string;
            winner: boolean | null;
        };
    };
    goals: {
        home: number | null;
        away: number | null;
    };
    score: {
        halftime: {
            home: number | null;
            away: number | null;
        };
        fulltime: {
            home: number | null;
            away: number | null;
        };
        extratime: {
            home: number | null;
            away: number | null;
        };
        penalty: {
            home: number | null;
            away: number | null;
        };
    };
}
interface APIFootballOdds {
    league: {
        id: number;
        name: string;
    };
    fixture: {
        id: number;
        date: string;
    };
    bookmakers: Array<{
        id: number;
        name: string;
        bets: Array<{
            id: number;
            name: string;
            values: Array<{
                value: string;
                odd: string;
            }>;
        }>;
    }>;
}
export interface FootballMatch {
    id: string;
    fixtureId: number;
    league: string;
    leagueLogo: string;
    leagueCountry: string;
    round: string;
    homeTeam: {
        id: number;
        name: string;
        logo: string;
    };
    awayTeam: {
        id: number;
        name: string;
        logo: string;
    };
    scheduledAt: Date;
    status: 'UPCOMING' | 'LIVE' | 'HALFTIME' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
    elapsed: number | null;
    homeScore: number;
    awayScore: number;
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    venue: string | null;
    tvChannels?: {
        name: string;
    }[];
}
@Injectable()
export class FootballService implements OnModuleInit {
    private readonly logger = new Logger(FootballService.name);
    private readonly baseUrl = 'https://api-football-v1.p.rapidapi.com/v3';
    private readonly apiKey: string;
    private readonly apiHost: string;
    private readonly sportDevsKey: string;
    private readonly sportDevsUrl = 'https://esports.sportdevs.com/matches-tv-channels';
    private readonly popularLeagues = [39, 140, 78, 135, 61, 2, 169];
    constructor(private readonly httpService: HttpService, private readonly configService: ConfigService, private readonly prisma: PrismaService, private readonly questService: QuestService, private readonly eventsGateway: EventsGateway) {
        this.apiKey = this.configService.get<string>('RAPIDAPI_KEY') || '';
        this.apiHost = this.configService.get<string>('RAPIDAPI_HOST') || 'api-football-v1.p.rapidapi.com';
        this.sportDevsKey = this.configService.get<string>('SPORTDEVS_API_KEY') || '';
        if (!this.apiKey) {
            this.logger.warn('RapidAPI key not configured for API-Football');
        }
    }
    async onModuleInit() {
        try {
            if (this.apiKey) {
                this.logger.log('Initializing football matches sync...');
                await this.syncMatches();
            }
        }
        catch (error: any) {
            this.logger.error(`[INIT] Football sync failed: ${error.message}`);
        }
        try {
            const matchCount = await this.prisma.footballMatch.count();
            if (matchCount === 0) {
                this.logger.warn('[INIT] No football matches in database, generating mock data...');
                await this.generateAndPersistMockMatches();
            }
            else {
                this.logger.log(`[INIT] Found ${matchCount} football matches in database`);
            }
        }
        catch (error: any) {
            this.logger.error(`[INIT] Failed to initialize mock matches: ${error.message}`);
        }
    }
    @Cron(CronExpression.EVERY_5_MINUTES)
    async syncMatches() {
        if (!this.apiKey) {
            this.logger.warn('No RapidAPI key, skipping football sync');
            return;
        }
        this.logger.log('Syncing football matches...');
        try {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const todayStr = today.toISOString().split('T')[0];
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            const todayMatches = await this.getFixturesByDate(todayStr);
            const tomorrowMatches = await this.getFixturesByDate(tomorrowStr);
            const allMatches = [...todayMatches, ...tomorrowMatches];
            this.logger.log(`Fetched ${allMatches.length} football matches`);
            for (const match of allMatches) {
                await this.upsertMatch(match);
            }
            this.logger.log('Football matches synced successfully');
        }
        catch (error: any) {
            this.logger.error(`Failed to sync football matches: ${error.message}`);
        }
    }
    private async getFixturesByDate(date: string): Promise<FootballMatch[]> {
        try {
            const response = await firstValueFrom(this.httpService.get<{
                response: APIFootballFixture[];
            }>(`${this.baseUrl}/fixtures`, {
                headers: {
                    'x-rapidapi-key': this.apiKey,
                    'x-rapidapi-host': this.apiHost,
                },
                params: {
                    date,
                },
            }));
            const fixtures = response.data.response || [];
            const filteredFixtures = fixtures.filter(f => this.popularLeagues.includes(f.league.id));
            const transforms = filteredFixtures.map(f => this.transformFixture(f));
            const decorated = await Promise.all(transforms.map(async (match) => ({
                ...match,
                tvChannels: await this.getTvChannelsByFixture(match.fixtureId),
            })));
            return decorated;
        }
        catch (error: any) {
            this.logger.error(`Failed to fetch fixtures for ${date}: ${error.message}`);
            return [];
        }
    }
    async getLiveMatches(): Promise<FootballMatch[]> {
        if (!this.apiKey)
            return [];
        try {
            const response = await firstValueFrom(this.httpService.get<{
                response: APIFootballFixture[];
            }>(`${this.baseUrl}/fixtures`, {
                headers: {
                    'x-rapidapi-key': this.apiKey,
                    'x-rapidapi-host': this.apiHost,
                },
                params: {
                    live: 'all',
                },
            }));
            const fixtures = response.data.response || [];
            const filteredFixtures = fixtures.filter(f => this.popularLeagues.includes(f.league.id));
            return filteredFixtures.map(f => this.transformFixture(f));
        }
        catch (error: any) {
            this.logger.error(`Failed to fetch live matches: ${error.message}`);
            return [];
        }
    }
    async getOdds(fixtureId: number): Promise<{
        home: number;
        draw: number;
        away: number;
    } | null> {
        if (!this.apiKey)
            return null;
        try {
            const response = await firstValueFrom(this.httpService.get<{
                response: APIFootballOdds[];
            }>(`${this.baseUrl}/odds`, {
                headers: {
                    'x-rapidapi-key': this.apiKey,
                    'x-rapidapi-host': this.apiHost,
                },
                params: {
                    fixture: fixtureId,
                },
            }));
            const oddsData = response.data.response?.[0];
            if (!oddsData)
                return null;
            const bookmaker = oddsData.bookmakers?.[0];
            const matchWinner = bookmaker?.bets?.find(b => b.name === 'Match Winner');
            if (!matchWinner)
                return null;
            const homeOdd = matchWinner.values.find(v => v.value === 'Home')?.odd;
            const drawOdd = matchWinner.values.find(v => v.value === 'Draw')?.odd;
            const awayOdd = matchWinner.values.find(v => v.value === 'Away')?.odd;
            return {
                home: parseFloat(homeOdd || '2.0'),
                draw: parseFloat(drawOdd || '3.0'),
                away: parseFloat(awayOdd || '2.0'),
            };
        }
        catch (error: any) {
            this.logger.error(`Failed to fetch odds for fixture ${fixtureId}: ${error.message}`);
            return null;
        }
    }
    private async getTvChannelsByFixture(fixtureId: number): Promise<{
        name: string;
    }[]> {
        if (!this.sportDevsKey)
            return [];
        try {
            const response = await firstValueFrom(this.httpService.get<{
                match_id: number;
                tv_channels: Array<{
                    name: string;
                }>;
            }[]>(this.sportDevsUrl, {
                headers: {
                    Authorization: `Bearer ${this.sportDevsKey}`,
                },
                params: {
                    match_id: `eq.${fixtureId}`,
                    lang: 'en',
                    limit: 5,
                },
            }));
            const rows = response.data || [];
            if (!rows.length)
                return [];
            return rows.flatMap(row => row.tv_channels || []).map(channel => ({ name: channel.name }));
        }
        catch (error: any) {
            this.logger.error(`Failed to fetch TV channels for fixture ${fixtureId}: ${error.message}`);
            return [];
        }
    }
    private transformFixture(fixture: APIFootballFixture): FootballMatch {
        let status: FootballMatch['status'];
        const statusShort = fixture.fixture.status.short;
        switch (statusShort) {
            case 'NS':
            case 'TBD':
                status = 'UPCOMING';
                break;
            case '1H':
            case '2H':
            case 'ET':
            case 'P':
            case 'LIVE':
                status = 'LIVE';
                break;
            case 'HT':
                status = 'HALFTIME';
                break;
            case 'FT':
            case 'AET':
            case 'PEN':
                status = 'FINISHED';
                break;
            case 'PST':
                status = 'POSTPONED';
                break;
            case 'CANC':
            case 'ABD':
            case 'AWD':
            case 'WO':
                status = 'CANCELLED';
                break;
            default:
                status = 'UPCOMING';
        }
        const baseOdds = 2.0;
        const variance = Math.random() * 0.8 - 0.4;
        return {
            id: `football-${fixture.fixture.id}`,
            fixtureId: fixture.fixture.id,
            league: fixture.league.name,
            leagueLogo: fixture.league.logo,
            leagueCountry: fixture.league.country,
            round: fixture.league.round,
            homeTeam: {
                id: fixture.teams.home.id,
                name: fixture.teams.home.name,
                logo: fixture.teams.home.logo,
            },
            awayTeam: {
                id: fixture.teams.away.id,
                name: fixture.teams.away.name,
                logo: fixture.teams.away.logo,
            },
            scheduledAt: new Date(fixture.fixture.date),
            status,
            elapsed: fixture.fixture.status.elapsed,
            homeScore: fixture.goals.home || 0,
            awayScore: fixture.goals.away || 0,
            homeOdds: Math.round((baseOdds + variance) * 100) / 100,
            drawOdds: Math.round((3.2 + variance * 0.5) * 100) / 100,
            awayOdds: Math.round((baseOdds - variance + 0.1) * 100) / 100,
            venue: fixture.fixture.venue?.name || null,
        };
    }
    private async upsertMatch(match: FootballMatch) {
        try {
            await this.prisma.footballMatch.upsert({
                where: { id: match.id },
                create: {
                    id: match.id,
                    fixtureId: match.fixtureId,
                    league: match.league,
                    leagueLogo: match.leagueLogo,
                    leagueCountry: match.leagueCountry,
                    round: match.round,
                    homeTeamId: match.homeTeam.id,
                    homeTeamName: match.homeTeam.name,
                    homeTeamLogo: match.homeTeam.logo,
                    awayTeamId: match.awayTeam.id,
                    awayTeamName: match.awayTeam.name,
                    awayTeamLogo: match.awayTeam.logo,
                    scheduledAt: match.scheduledAt,
                    status: match.status,
                    elapsed: match.elapsed,
                    homeScore: match.homeScore,
                    awayScore: match.awayScore,
                    homeOdds: match.homeOdds,
                    drawOdds: match.drawOdds,
                    awayOdds: match.awayOdds,
                    venue: match.venue,
                    tvChannels: match.tvChannels,
                },
                update: {
                    status: match.status,
                    elapsed: match.elapsed,
                    homeScore: match.homeScore,
                    awayScore: match.awayScore,
                    homeOdds: match.homeOdds,
                    drawOdds: match.drawOdds,
                    awayOdds: match.awayOdds,
                    tvChannels: match.tvChannels,
                },
            });
        }
        catch (error: any) {
            this.logger.debug(`Database upsert skipped: ${error.message}`);
        }
    }
    async generateAndPersistMockMatches(): Promise<FootballMatch[]> {
        const now = new Date();
        const leagues = this.getPopularLeagues();
        const teams = [
            { id: 33, name: 'Manchester United', logo: 'https://media.api-sports.io/football/teams/33.png' },
            { id: 34, name: 'Newcastle', logo: 'https://media.api-sports.io/football/teams/34.png' },
            { id: 40, name: 'Liverpool', logo: 'https://media.api-sports.io/football/teams/40.png' },
            { id: 42, name: 'Arsenal', logo: 'https://media.api-sports.io/football/teams/42.png' },
            { id: 49, name: 'Chelsea', logo: 'https://media.api-sports.io/football/teams/49.png' },
            { id: 50, name: 'Manchester City', logo: 'https://media.api-sports.io/football/teams/50.png' },
            { id: 529, name: 'Barcelona', logo: 'https://media.api-sports.io/football/teams/529.png' },
            { id: 541, name: 'Real Madrid', logo: 'https://media.api-sports.io/football/teams/541.png' },
            { id: 530, name: 'Atletico Madrid', logo: 'https://media.api-sports.io/football/teams/530.png' },
            { id: 157, name: 'Bayern Munich', logo: 'https://media.api-sports.io/football/teams/157.png' },
            { id: 165, name: 'Borussia Dortmund', logo: 'https://media.api-sports.io/football/teams/165.png' },
            { id: 489, name: 'AC Milan', logo: 'https://media.api-sports.io/football/teams/489.png' },
            { id: 505, name: 'Inter', logo: 'https://media.api-sports.io/football/teams/505.png' },
            { id: 496, name: 'Juventus', logo: 'https://media.api-sports.io/football/teams/496.png' },
            { id: 85, name: 'Paris Saint Germain', logo: 'https://media.api-sports.io/football/teams/85.png' },
            { id: 91, name: 'Monaco', logo: 'https://media.api-sports.io/football/teams/91.png' },
        ];
        const mockMatches: FootballMatch[] = [];
        let fixtureId = 1000000;
        const liveLeague = leagues[0];
        const liveMatch: FootballMatch = {
            id: `football-${fixtureId}`,
            fixtureId: fixtureId++,
            league: liveLeague.name,
            leagueLogo: liveLeague.logo,
            leagueCountry: liveLeague.country,
            round: 'Round 22',
            homeTeam: teams[0],
            awayTeam: teams[1],
            scheduledAt: new Date(now.getTime() - 45 * 60 * 1000),
            status: 'LIVE',
            elapsed: 52,
            homeScore: 1,
            awayScore: 1,
            homeOdds: 2.10,
            drawOdds: 3.25,
            awayOdds: 3.50,
            venue: 'Old Trafford',
        };
        mockMatches.push(liveMatch);
        await this.upsertMatch(liveMatch);
        const upcomingMatches = [
            { home: teams[2], away: teams[3], league: leagues[0], hours: 2, venue: 'Anfield' },
            { home: teams[4], away: teams[5], league: leagues[0], hours: 4, venue: 'Stamford Bridge' },
            { home: teams[6], away: teams[7], league: leagues[1], hours: 3, venue: 'Camp Nou' },
            { home: teams[8], away: teams[9], league: leagues[1], hours: 5, venue: 'Wanda Metropolitano' },
            { home: teams[10], away: teams[11], league: leagues[2], hours: 6, venue: 'Allianz Arena' },
            { home: teams[12], away: teams[13], league: leagues[3], hours: 7, venue: 'San Siro' },
            { home: teams[14], away: teams[15], league: leagues[4], hours: 8, venue: 'Parc des Princes' },
        ];
        for (const match of upcomingMatches) {
            const variance = Math.random() * 0.6 - 0.3;
            const mockMatch: FootballMatch = {
                id: `football-${fixtureId}`,
                fixtureId: fixtureId++,
                league: match.league.name,
                leagueLogo: match.league.logo,
                leagueCountry: match.league.country,
                round: 'Round 22',
                homeTeam: match.home,
                awayTeam: match.away,
                scheduledAt: new Date(now.getTime() + match.hours * 60 * 60 * 1000),
                status: 'UPCOMING',
                elapsed: null,
                homeScore: 0,
                awayScore: 0,
                homeOdds: Math.round((2.0 + variance) * 100) / 100,
                drawOdds: Math.round((3.2 + variance * 0.5) * 100) / 100,
                awayOdds: Math.round((2.1 - variance) * 100) / 100,
                venue: match.venue,
                tvChannels: [],
            };
            mockMatches.push(mockMatch);
            await this.upsertMatch(mockMatch);
        }
        this.logger.log(`Generated and persisted ${mockMatches.length} mock football matches (API unavailable)`);
        return mockMatches;
    }
    async getMatches(options?: {
        league?: number;
        status?: string;
        limit?: number;
    }): Promise<FootballMatch[]> {
        const { league, status, limit = 20 } = options || {};
        try {
            const matches = await this.prisma.footballMatch.findMany({
                where: {
                    ...(league && { leagueId: league }),
                    ...(status && { status }),
                },
                orderBy: [
                    { status: 'asc' },
                    { scheduledAt: 'asc' },
                ],
                take: limit,
            });
            if (matches.length > 0) {
                return matches.map(m => ({
                    id: m.id,
                    fixtureId: m.fixtureId,
                    league: m.league,
                    leagueLogo: m.leagueLogo || '',
                    leagueCountry: m.leagueCountry || '',
                    round: m.round || '',
                    homeTeam: {
                        id: m.homeTeamId,
                        name: m.homeTeamName,
                        logo: m.homeTeamLogo || '',
                    },
                    awayTeam: {
                        id: m.awayTeamId,
                        name: m.awayTeamName,
                        logo: m.awayTeamLogo || '',
                    },
                    scheduledAt: m.scheduledAt,
                    status: m.status as FootballMatch['status'],
                    elapsed: m.elapsed,
                    homeScore: m.homeScore,
                    awayScore: m.awayScore,
                    homeOdds: m.homeOdds,
                    drawOdds: m.drawOdds,
                    awayOdds: m.awayOdds,
                    venue: m.venue,
                    tvChannels: (m.tvChannels as {
                        name: string;
                    }[]) || [],
                }));
            }
        }
        catch (error) {
        }
        const today = new Date().toISOString().split('T')[0];
        let matches = await this.getFixturesByDate(today);
        if (matches.length === 0) {
            matches = await this.generateAndPersistMockMatches();
        }
        if (league) {
            matches = matches.filter(m => {
                const leagueInfo = this.getPopularLeagues().find(l => l.name === m.league);
                return leagueInfo?.id === league;
            });
        }
        return matches.slice(0, limit);
    }
    async getHotMatches(limit = 5): Promise<FootballMatch[]> {
        const matches = await this.getMatches({ limit: 50 });
        const sorted = matches.sort((a, b) => {
            if (a.status === 'LIVE' && b.status !== 'LIVE')
                return -1;
            if (a.status !== 'LIVE' && b.status === 'LIVE')
                return 1;
            return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
        });
        return sorted.slice(0, limit);
    }
    getPopularLeagues() {
        return [
            { id: 39, name: '英超', country: 'England', logo: 'https://media.api-sports.io/football/leagues/39.png' },
            { id: 140, name: '西甲', country: 'Spain', logo: 'https://media.api-sports.io/football/leagues/140.png' },
            { id: 78, name: '德甲', country: 'Germany', logo: 'https://media.api-sports.io/football/leagues/78.png' },
            { id: 135, name: '意甲', country: 'Italy', logo: 'https://media.api-sports.io/football/leagues/135.png' },
            { id: 61, name: '法甲', country: 'France', logo: 'https://media.api-sports.io/football/leagues/61.png' },
            { id: 2, name: '欧冠', country: 'World', logo: 'https://media.api-sports.io/football/leagues/2.png' },
            { id: 169, name: '中超', country: 'China', logo: 'https://media.api-sports.io/football/leagues/169.png' },
        ];
    }
    async placeBet(_data: {
        userId: string;
        matchId: string;
        prediction: 'HOME' | 'DRAW' | 'AWAY';
        amount: number;
    }) {
        throw new BadRequestException('样品演示：足球下注已禁用');
    }
    async settleMatches() {
        const finishedMatches = await this.prisma.footballMatch.findMany({
            where: {
                status: { in: ['FINISHED', 'CANCELLED'] },
                settled: { not: true },
            },
        });
        for (const match of finishedMatches) {
            try {
                await this.settleMatch(match.id);
            }
            catch (error: any) {
                this.logger.error(`Failed to settle match ${match.id}: ${error.message}`);
            }
        }
    }
    private async settleMatch(matchId: string) {
        const match = await this.prisma.footballMatch.findUnique({
            where: { id: matchId },
        });
        if (!match || match.settled) {
            this.logger.debug(`Match ${matchId} already settled or not found`);
            return;
        }
        let winner: 'HOME' | 'DRAW' | 'AWAY' | null = null;
        if (match.homeScore > match.awayScore) {
            winner = 'HOME';
        }
        else if (match.homeScore < match.awayScore) {
            winner = 'AWAY';
        }
        else if (match.homeScore === match.awayScore) {
            winner = 'DRAW';
        }
        if (!winner) {
            this.logger.warn(`Cannot determine winner for match ${matchId}`);
            return;
        }
        const bets = await this.prisma.footballBet.findMany({
            where: { matchId, status: 'PENDING' },
        });
        if (bets.length === 0) {
            await this.prisma.footballMatch.update({
                where: { id: matchId },
                data: { settled: true },
            });
            return;
        }
        const totalPool = bets.reduce((sum, bet) => sum + bet.amount, 0);
        const winBets = bets.filter(bet => bet.prediction === winner);
        const winPool = winBets.reduce((sum, bet) => sum + bet.amount, 0);
        await this.prisma.$transaction(async (tx) => {
            for (const bet of bets) {
                if (bet.prediction === winner) {
                    const profit = (bet.amount / winPool) * (totalPool - winPool);
                    const payout = bet.amount + profit;
                    const user = await tx.user.findUnique({ where: { id: bet.userId } });
                    if (user) {
                        const updatedUser = await tx.user.update({
                            where: { id: bet.userId, version: user.version },
                            data: {
                                pts: { increment: payout },
                                combo: { increment: 1 },
                                multiplier: Math.min(user.multiplier + 0.1, 3.0),
                                version: { increment: 1 },
                            },
                        });
                        this.eventsGateway.emitBalanceUpdate(bet.userId, updatedUser.pts);
                        this.eventsGateway.emitBetSuccess(bet.userId, {
                            betId: bet.id,
                            result: 'WIN',
                            amount: bet.amount,
                            odds: bet.odds,
                            payout: parseFloat(payout.toFixed(2)),
                            profit: parseFloat(profit.toFixed(2)),
                        });
                    }
                    await tx.footballBet.update({
                        where: { id: bet.id },
                        data: {
                            status: 'WON',
                            payout: parseFloat(payout.toFixed(2)),
                            result: 'WIN',
                            settledAt: new Date(),
                        },
                    });
                }
                else {
                    const user = await tx.user.findUnique({ where: { id: bet.userId } });
                    if (user) {
                        await tx.user.update({
                            where: { id: bet.userId, version: user.version },
                            data: {
                                combo: 0,
                                multiplier: 1.0,
                                version: { increment: 1 },
                            },
                        });
                    }
                    this.eventsGateway.emitBetSuccess(bet.userId, {
                        betId: bet.id,
                        result: 'LOSE',
                        amount: bet.amount,
                        odds: bet.odds,
                        payout: 0,
                    });
                    await tx.footballBet.update({
                        where: { id: bet.id },
                        data: {
                            status: 'LOST',
                            payout: 0,
                            result: 'LOSE',
                            settledAt: new Date(),
                        },
                    });
                }
            }
            await tx.footballMatch.update({
                where: { id: matchId },
                data: { settled: true },
            });
        });
        this.logger.log(`[FOOTBALL_SETTLE] Match ${matchId} settled: Winner=${winner}, ` +
            `Payout=${winBets.length} winners from ${bets.length} total bets`);
    }
    @Cron(CronExpression.EVERY_5_MINUTES)
    async checkAndSettleMatches() {
        try {
            await this.settleMatches();
        }
        catch (error: any) {
            this.logger.error(`Error in settlement cron: ${error.message}`);
        }
    }
    async initMockMatches(): Promise<number> {
        try {
            const matches = await this.generateAndPersistMockMatches();
            this.logger.log(`[DEV] Initialized ${matches.length} mock matches`);
            return matches.length;
        }
        catch (error: any) {
            this.logger.error(`[DEV] Failed to initialize mock matches: ${error.message}`);
            throw error;
        }
    }
}
