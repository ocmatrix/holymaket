import { Controller, Get, Post, Body, Query, Param, UseGuards } from '@nestjs/common';
import { FootballService } from './football.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminTokenGuard } from '../auth/guards/admin-token.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.service';
@Controller('api/football')
export class FootballController {
    constructor(private readonly footballService: FootballService) { }
    @Get('matches')
    async getMatches(
    @Query('league')
    league?: string, 
    @Query('status')
    status?: string, 
    @Query('limit')
    limit?: string) {
        const matches = await this.footballService.getMatches({
            league: league ? parseInt(league) : undefined,
            status,
            limit: limit ? parseInt(limit) : 20,
        });
        return {
            success: true,
            data: matches,
            count: matches.length,
        };
    }
    @Get('live')
    async getLiveMatches() {
        const matches = await this.footballService.getLiveMatches();
        return {
            success: true,
            data: matches,
            count: matches.length,
        };
    }
    @Get('hot')
    async getHotMatches(
    @Query('limit')
    limit?: string) {
        const matches = await this.footballService.getHotMatches(limit ? parseInt(limit) : 5);
        return {
            success: true,
            data: matches,
            count: matches.length,
        };
    }
    @Get('odds/:fixtureId')
    async getOdds(
    @Param('fixtureId')
    fixtureId: string) {
        const odds = await this.footballService.getOdds(parseInt(fixtureId));
        return {
            success: true,
            data: odds,
        };
    }
    @Get('leagues')
    async getLeagues() {
        const leagues = this.footballService.getPopularLeagues();
        return {
            success: true,
            data: leagues,
        };
    }
    @Post('bet')
    @UseGuards(JwtAuthGuard)
    async placeBet(
    @CurrentUser()
    currentUser: JwtPayload,
    @Body()
    body: {
        matchId: string;
        prediction: 'HOME' | 'DRAW' | 'AWAY';
        amount: number;
    }) {
        return this.footballService.placeBet({ ...body, userId: currentUser.sub });
    }
    @Get('sync')
    @UseGuards(AdminTokenGuard)
    async syncMatches() {
        await this.footballService.syncMatches();
        return {
            success: true,
            message: 'Football matches sync initiated',
        };
    }
    @Post('init-mock')
    @UseGuards(AdminTokenGuard)
    async initMockMatches() {
        const result = await this.footballService.initMockMatches();
        return {
            success: true,
            message: `Generated ${result} mock matches`,
            count: result,
        };
    }
}
