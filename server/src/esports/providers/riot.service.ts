import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { EsportsMatchDto } from '../esports.service';
@Injectable()
export class RiotService {
    private readonly logger = new Logger(RiotService.name);
    private readonly ESPORTS_API = 'https://esports-api.lolesports.com/persisted/gw';
    private readonly API_KEY = '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z';
    private readonly LPL_TEAMS = [
        { id: 'blg', name: 'Bilibili Gaming', shortName: 'BLG', logo: '🦁' },
        { id: 'jdg', name: 'JD Gaming', shortName: 'JDG', logo: '🐉' },
        { id: 't1', name: 'T1', shortName: 'T1', logo: '⚡' },
        { id: 'geng', name: 'Gen.G', shortName: 'GEN', logo: '🐯' },
        { id: 'edg', name: 'EDward Gaming', shortName: 'EDG', logo: '🦅' },
        { id: 'tes', name: 'Top Esports', shortName: 'TES', logo: '🔥' },
        { id: 'weibo', name: 'Weibo Gaming', shortName: 'WBG', logo: '🐺' },
        { id: 'lng', name: 'LNG Esports', shortName: 'LNG', logo: '🐍' },
    ];
    private readonly LEAGUES = [
        { id: 'lpl', name: 'LPL', region: 'CN', tournament: 'LPL Spring 2026' },
        { id: 'lck', name: 'LCK', region: 'KR', tournament: 'LCK Spring 2026' },
        { id: 'lec', name: 'LEC', region: 'EU', tournament: 'LEC Winter 2026' },
        { id: 'worlds', name: 'World Championship', region: 'GLOBAL', tournament: 'Worlds 2026' },
    ];
    constructor(private httpService: HttpService) { }
    async getLiveAndUpcomingMatches(): Promise<EsportsMatchDto[]> {
        const simulatedMatches = this.generateSimulatedMatches();
        this.logger.log(`Generated ${simulatedMatches.length} simulated LOL matches`);
        if (this.API_KEY) {
            try {
                const realMatches = await this.fetchFromRiotAPI();
                if (realMatches.length > 0) {
                    this.logger.log(`Fetched ${realMatches.length} real LOL matches from Riot API`);
                    return [...realMatches, ...simulatedMatches.slice(0, 2)];
                }
            }
            catch (error) {
                this.logger.warn('Failed to fetch from Riot API, using simulated data only');
            }
        }
        return simulatedMatches;
    }
    private async fetchFromRiotAPI(): Promise<EsportsMatchDto[]> {
        const headers = {
            'x-api-key': this.API_KEY,
        };
        try {
            const response = await firstValueFrom(this.httpService.get(`${this.ESPORTS_API}/getSchedule`, {
                headers,
                params: {
                    hl: 'en-US',
                },
            }));
            const schedule = response.data?.data?.schedule?.events || [];
            return schedule.map((event: any) => this.mapRiotEventToMatch(event));
        }
        catch (error) {
            this.logger.error('Riot API error', error);
            throw error;
        }
    }
    private mapRiotEventToMatch(event: any): EsportsMatchDto {
        const match = event.match;
        const teams = match?.teams || [];
        return {
            id: `riot_${event.id}`,
            game: 'LOL',
            league: event.league?.name || 'Unknown',
            tournament: event.blockName || undefined,
            homeTeam: {
                id: `riot_team_${teams[0]?.code || 'unknown'}`,
                name: teams[0]?.name || 'Team A',
                shortName: teams[0]?.code,
                logo: teams[0]?.image || undefined,
            },
            awayTeam: {
                id: `riot_team_${teams[1]?.code || 'unknown'}`,
                name: teams[1]?.name || 'Team B',
                shortName: teams[1]?.code,
                logo: teams[1]?.image || undefined,
            },
            bestOf: match?.strategy?.count || 1,
            scheduledAt: new Date(event.startTime),
            status: this.mapRiotStatus(event.state),
            homeScore: teams[0]?.result?.gameWins || 0,
            awayScore: teams[1]?.result?.gameWins || 0,
            homeOdds: this.calculateOdds(0.5),
            awayOdds: this.calculateOdds(0.5),
            streamUrl: event.streams?.[0]?.provider === 'twitch'
                ? `https://twitch.tv/${event.streams[0].parameter}`
                : undefined,
        };
    }
    private mapRiotStatus(state: string): 'UPCOMING' | 'LIVE' | 'FINISHED' {
        switch (state) {
            case 'inProgress':
                return 'LIVE';
            case 'completed':
                return 'FINISHED';
            default:
                return 'UPCOMING';
        }
    }
    private generateSimulatedMatches(): EsportsMatchDto[] {
        const matches: EsportsMatchDto[] = [];
        const now = new Date();
        const matchCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < matchCount; i++) {
            const league = this.LEAGUES[Math.floor(Math.random() * this.LEAGUES.length)];
            const shuffledTeams = [...this.LPL_TEAMS].sort(() => Math.random() - 0.5);
            const homeTeam = shuffledTeams[0];
            const awayTeam = shuffledTeams[1];
            let status: 'UPCOMING' | 'LIVE' | 'FINISHED' = 'UPCOMING';
            let scheduledAt = new Date(now.getTime() + (i + 1) * 60 * 60 * 1000);
            let homeScore = 0;
            let awayScore = 0;
            if (i === 0 && Math.random() > 0.3) {
                status = 'LIVE';
                scheduledAt = new Date(now.getTime() - 30 * 60 * 1000);
                homeScore = Math.floor(Math.random() * 2);
                awayScore = Math.floor(Math.random() * 2);
            }
            const bestOf = [1, 3, 5][Math.floor(Math.random() * 3)];
            const homeWinProb = 0.3 + Math.random() * 0.4;
            matches.push({
                id: `lol_sim_${Date.now()}_${i}`,
                game: 'LOL',
                league: league.name,
                tournament: league.tournament,
                homeTeam: {
                    id: `lol_${homeTeam.id}`,
                    name: homeTeam.name,
                    shortName: homeTeam.shortName,
                    logo: homeTeam.logo,
                },
                awayTeam: {
                    id: `lol_${awayTeam.id}`,
                    name: awayTeam.name,
                    shortName: awayTeam.shortName,
                    logo: awayTeam.logo,
                },
                bestOf,
                scheduledAt,
                status,
                homeScore,
                awayScore,
                homeOdds: this.calculateOdds(homeWinProb),
                awayOdds: this.calculateOdds(1 - homeWinProb),
                streamUrl: status === 'LIVE' ? 'https://twitch.tv/lpl' : undefined,
            });
        }
        return matches;
    }
    private calculateOdds(winProbability: number): number {
        const baseOdds = 1 / winProbability;
        const margin = 0.95;
        return Math.round(baseOdds * margin * 100) / 100;
    }
}
