import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
export interface PandaScoreMatch {
    id: number;
    name: string;
    slug: string;
    status: 'not_started' | 'running' | 'finished' | 'canceled' | 'postponed';
    scheduled_at: string;
    begin_at: string | null;
    end_at: string | null;
    number_of_games: number;
    videogame: {
        id: number;
        name: string;
        slug: string;
    };
    league: {
        id: number;
        name: string;
        slug: string;
        image_url: string | null;
    };
    tournament: {
        id: number;
        name: string;
        slug: string;
    };
    opponents: Array<{
        opponent: {
            id: number;
            name: string;
            acronym: string | null;
            image_url: string | null;
            location: string | null;
        };
        type: 'Team' | 'Player';
    }>;
    results: Array<{
        team_id: number;
        score: number;
    }>;
    streams_list: Array<{
        language: string;
        main: boolean;
        official: boolean;
        raw_url: string;
        embed_url: string | null;
    }>;
    live: {
        supported: boolean;
        url: string | null;
    };
}
@Injectable()
export class PandaScoreService {
    private readonly logger = new Logger(PandaScoreService.name);
    private readonly baseUrl = 'https://api.pandascore.co';
    private readonly token: string;
    private readonly fallbackStreams: Record<'LOL' | 'DOTA2' | 'CS2', string> = {
        LOL: 'https://twitch.tv/lpl',
        DOTA2: 'https://twitch.tv/pgl',
        CS2: 'https://twitch.tv/esl_cs',
    };
    constructor(private readonly httpService: HttpService, private readonly configService: ConfigService) {
        this.token = this.configService.get<string>('PANDASCORE_API_TOKEN') || '';
        if (!this.token) {
            this.logger.warn('PandaScore API token not configured');
        }
    }
    async getUpcomingLOLMatches(limit = 10): Promise<PandaScoreMatch[]> {
        return this.getUpcomingMatches('lol', limit);
    }
    async getUpcomingDota2Matches(limit = 10): Promise<PandaScoreMatch[]> {
        return this.getUpcomingMatches('dota2', limit);
    }
    async getUpcomingCS2Matches(limit = 10): Promise<PandaScoreMatch[]> {
        return this.getUpcomingMatches('csgo', limit);
    }
    async getRunningLOLMatches(): Promise<PandaScoreMatch[]> {
        return this.getRunningMatches('lol');
    }
    async getRunningDota2Matches(): Promise<PandaScoreMatch[]> {
        return this.getRunningMatches('dota2');
    }
    async getRunningCS2Matches(): Promise<PandaScoreMatch[]> {
        return this.getRunningMatches('csgo');
    }
    private async getUpcomingMatches(game: string, limit = 10): Promise<PandaScoreMatch[]> {
        if (!this.token) {
            this.logger.warn('No PandaScore token, returning empty matches');
            return [];
        }
        try {
            const url = `${this.baseUrl}/${game}/matches/upcoming`;
            const response = await firstValueFrom(this.httpService.get<PandaScoreMatch[]>(url, {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
                params: {
                    per_page: limit,
                    sort: 'scheduled_at',
                },
            }));
            this.logger.log(`Fetched ${response.data.length} upcoming ${game} matches from PandaScore`);
            return response.data;
        }
        catch (error: any) {
            this.logger.error(`Failed to fetch upcoming ${game} matches: ${error.message}`);
            return [];
        }
    }
    private async getRunningMatches(game: string): Promise<PandaScoreMatch[]> {
        if (!this.token) {
            this.logger.warn('No PandaScore token, returning empty matches');
            return [];
        }
        try {
            const url = `${this.baseUrl}/${game}/matches/running`;
            const response = await firstValueFrom(this.httpService.get<PandaScoreMatch[]>(url, {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            }));
            this.logger.log(`Fetched ${response.data.length} running ${game} matches from PandaScore`);
            return response.data;
        }
        catch (error: any) {
            this.logger.error(`Failed to fetch running ${game} matches: ${error.message}`);
            return [];
        }
    }
    transformMatch(match: PandaScoreMatch, gameCode: 'LOL' | 'DOTA2' | 'CS2') {
        const homeOpponent = match.opponents[0]?.opponent;
        const awayOpponent = match.opponents[1]?.opponent;
        if (!homeOpponent || !awayOpponent) {
            return null;
        }
        const homeResult = match.results.find(r => r.team_id === homeOpponent.id);
        const awayResult = match.results.find(r => r.team_id === awayOpponent.id);
        const mainStream = match.streams_list.find(s => s.main) || match.streams_list[0];
        const streamUrl = mainStream?.embed_url ||
            mainStream?.raw_url ||
            match.live?.url ||
            null;
        let status: 'UPCOMING' | 'LIVE' | 'FINISHED' | 'CANCELLED' | 'POSTPONED';
        switch (match.status) {
            case 'running':
                status = 'LIVE';
                break;
            case 'finished':
                status = 'FINISHED';
                break;
            case 'canceled':
                status = 'CANCELLED';
                break;
            case 'postponed':
                status = 'POSTPONED';
                break;
            default:
                status = 'UPCOMING';
        }
        const finalStreamUrl = status === 'LIVE'
            ? (streamUrl || this.fallbackStreams[gameCode] || null)
            : streamUrl;
        const baseOdds = 1.85;
        const variance = Math.random() * 0.4 - 0.2;
        const homeOdds = Math.round((baseOdds + variance) * 100) / 100;
        const awayOdds = Math.round((baseOdds - variance + 0.1) * 100) / 100;
        return {
            id: `pandascore-${match.id}`,
            game: gameCode,
            league: match.league.name,
            leagueLogo: match.league.image_url,
            tournament: match.tournament?.name,
            homeTeam: {
                id: `ps-team-${homeOpponent.id}`,
                name: homeOpponent.name,
                shortName: homeOpponent.acronym || homeOpponent.name.slice(0, 4).toUpperCase(),
                logo: homeOpponent.image_url,
                region: homeOpponent.location,
            },
            awayTeam: {
                id: `ps-team-${awayOpponent.id}`,
                name: awayOpponent.name,
                shortName: awayOpponent.acronym || awayOpponent.name.slice(0, 4).toUpperCase(),
                logo: awayOpponent.image_url,
                region: awayOpponent.location,
            },
            bestOf: match.number_of_games,
            scheduledAt: new Date(match.scheduled_at || match.begin_at || new Date()),
            status,
            homeScore: homeResult?.score || 0,
            awayScore: awayResult?.score || 0,
            homeOdds,
            awayOdds,
            streamUrl: finalStreamUrl,
        };
    }
    async getAllUpcomingAndRunningMatches() {
        const [upcomingLOL, upcomingDota2, upcomingCS2, runningLOL, runningDota2, runningCS2,] = await Promise.all([
            this.getUpcomingLOLMatches(10),
            this.getUpcomingDota2Matches(10),
            this.getUpcomingCS2Matches(10),
            this.getRunningLOLMatches(),
            this.getRunningDota2Matches(),
            this.getRunningCS2Matches(),
        ]);
        const lolMatches = [...runningLOL, ...upcomingLOL]
            .map(m => this.transformMatch(m, 'LOL'))
            .filter(Boolean);
        const dota2Matches = [...runningDota2, ...upcomingDota2]
            .map(m => this.transformMatch(m, 'DOTA2'))
            .filter(Boolean);
        const cs2Matches = [...runningCS2, ...upcomingCS2]
            .map(m => this.transformMatch(m, 'CS2'))
            .filter(Boolean);
        return {
            lol: lolMatches,
            dota2: dota2Matches,
            cs2: cs2Matches,
            all: [...lolMatches, ...dota2Matches, ...cs2Matches].sort((a, b) => {
                if (a!.status === 'LIVE' && b!.status !== 'LIVE')
                    return -1;
                if (a!.status !== 'LIVE' && b!.status === 'LIVE')
                    return 1;
                return new Date(a!.scheduledAt).getTime() - new Date(b!.scheduledAt).getTime();
            }),
        };
    }
}
