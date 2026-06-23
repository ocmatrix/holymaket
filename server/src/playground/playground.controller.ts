import { Controller, Get, Post, Body, Query, Logger, UseGuards } from '@nestjs/common';
import { PlaygroundService } from './playground.service';
import { MarketOutcome } from '@prisma/client';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.service';
@ApiTags('playground')
@Controller('playground')
export class PlaygroundController {
    private readonly logger = new Logger(PlaygroundController.name);
    constructor(private readonly playgroundService: PlaygroundService) { }
    @Get('agents')
    @ApiOperation({ summary: '获取所有 AI 代理' })
    getAgents(
    @Query('userId')
    userId?: string) {
        return this.playgroundService.getAgents(userId);
    }
    @Post('battle')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '开始一场 AI 对战' })
    async startBattle(
    @CurrentUser()
    currentUser: JwtPayload,
    @Body()
    body: {
        agentId: string;
        userPick: MarketOutcome;
        language?: string;
        amount?: number;
    }) {
        try {
            return await this.playgroundService.startBattle(currentUser.sub, body.agentId, body.userPick, body.language, body.amount);
        }
        catch (error) {
            this.logger.error(`[BATTLE_ERROR] ${error.message}`, error.stack);
            throw error;
        }
    }
    @Get('recent/:userId')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '获取用户最近的对战记录' })
    getRecentBattles(
    @CurrentUser()
    currentUser: JwtPayload,
    @Query('limit')
    limit?: string) {
        return this.playgroundService.getRecentBattles(currentUser.sub, limit ? parseInt(limit, 10) : undefined);
    }
    @Get('stats/:userId')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '获取用户 Battle 统计（对战胜率、净盈亏、ROI）' })
    getBattleStats(
    @CurrentUser()
    currentUser: JwtPayload) {
        return this.playgroundService.getBattleStats(currentUser.sub);
    }
}
