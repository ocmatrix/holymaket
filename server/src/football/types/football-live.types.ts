export type FootballEventType = 'GOAL' | 'OWN_GOAL' | 'PENALTY' | 'RED_CARD' | 'YELLOW_CARD' | 'SUBSTITUTION' | 'VAR' | 'MATCH_START' | 'HALFTIME' | 'FULLTIME' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT';
export interface FootballEvent {
    id: string;
    matchId: string;
    fixtureId: number;
    type: FootballEventType;
    timestamp: Date;
    minute: number;
    team: 'HOME' | 'AWAY';
    player: {
        name: string;
        id?: number;
    };
    detail?: string;
    relatedPlayer?: {
        name: string;
        id?: number;
    };
}
export interface MatchLiveUpdate {
    matchId: string;
    fixtureId: number;
    status: 'UPCOMING' | 'LIVE' | 'HALFTIME' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
    elapsed: number | null;
    homeScore: number;
    awayScore: number;
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
    league: string;
    venue: string | null;
    scheduledAt: Date;
    updatedAt: Date;
}
export interface OddsUpdate {
    matchId: string;
    fixtureId: number;
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    updatedAt: Date;
}
export interface BettingPoolStats {
    matchId: string;
    fixtureId: number;
    homeBetPool: number;
    drawBetPool: number;
    awayBetPool: number;
    homeBetCount: number;
    drawBetCount: number;
    awayBetCount: number;
    totalPool: number;
    updatedAt: Date;
}
export interface MatchLivePayload {
    type: 'MATCH_UPDATE' | 'EVENT' | 'ODDS_UPDATE' | 'BETTING_STATS' | 'MATCH_STATUS_CHANGE';
    data: MatchLiveUpdate | FootballEvent | OddsUpdate | BettingPoolStats | {
        matchId: string;
        status: string;
    };
    timestamp: Date;
}
export interface LiveMatchManager {
    matchId: string;
    fixtureId: number;
    isLive: boolean;
    lastUpdate: Date;
    updateInterval?: NodeJS.Timer;
    lastScore?: {
        home: number;
        away: number;
    };
    lastElapsed?: number;
}
