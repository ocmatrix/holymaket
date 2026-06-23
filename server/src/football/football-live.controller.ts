import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { FootballLiveService } from './football-live.service';
import { FootballEvent } from './types/football-live.types';
import { AdminTokenGuard } from '../auth/guards/admin-token.guard';
@Controller('api/football/live')
export class FootballLiveController {
    constructor(private readonly footballLiveService: FootballLiveService) { }
    @Get('matches')
    getAllLiveMatches() {
        const matches = this.footballLiveService.getAllLiveMatches();
        return {
            success: true,
            data: matches,
            count: matches.length,
        };
    }
    @Get('matches/:matchId/status')
    checkMatchLiveStatus(
    @Param('matchId')
    matchId: string) {
        const isLive = this.footballLiveService.isMatchLive(matchId);
        return {
            success: true,
            data: {
                matchId,
                isLive,
            },
        };
    }
    @Post('matches/:matchId/register')
    @UseGuards(AdminTokenGuard)
    registerLiveMatch(
    @Param('matchId')
    matchId: string) {
        this.footballLiveService.registerLiveMatch(matchId);
        return {
            success: true,
            message: `Match ${matchId} registered for live updates`,
        };
    }
    @Post('matches/:matchId/unregister')
    @UseGuards(AdminTokenGuard)
    unregisterLiveMatch(
    @Param('matchId')
    matchId: string) {
        this.footballLiveService.unregisterLiveMatch(matchId);
        return {
            success: true,
            message: `Match ${matchId} unregistered from live updates`,
        };
    }
    @Get('matches/:matchId/events')
    getMatchEvents(
    @Param('matchId')
    matchId: string) {
        const events = this.footballLiveService.getMatchEvents(matchId);
        return {
            success: true,
            data: events,
            count: events.length,
        };
    }
    @Post('matches/:matchId/events')
    @UseGuards(AdminTokenGuard)
    addEvent(
    @Param('matchId')
    matchId: string, 
    @Body()
    event: {
        type: string;
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
    }) {
        const fixtureId = parseInt(matchId.split('-')[1]);
        this.footballLiveService.addEvent(matchId, {
            ...event,
            matchId,
            fixtureId,
            timestamp: new Date(),
            type: event.type as any,
        });
        return {
            success: true,
            message: `Event added for match ${matchId}`,
        };
    }
    @Post('matches/:matchId/events/clear')
    @UseGuards(AdminTokenGuard)
    clearMatchEvents(
    @Param('matchId')
    matchId: string) {
        this.footballLiveService.clearMatchEvents(matchId);
        return {
            success: true,
            message: `Events cleared for match ${matchId}`,
        };
    }
}
