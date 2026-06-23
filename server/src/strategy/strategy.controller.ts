import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.service';
@ApiTags('strategy')
@Controller('strategy')
export class StrategyController {
    constructor(private readonly strategyService: StrategyService) { }
    @Get('presets')
    @ApiOperation({ summary: '获取预设策略列表' })
    getPresetStrategies() {
        return this.strategyService.getPresetStrategies();
    }
    @Get('user/:userId')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '获取用户自定义策略' })
    getUserStrategies(
    @CurrentUser()
    currentUser: JwtPayload) {
        return this.strategyService.getUserStrategies(currentUser.sub);
    }
    @Post('user/:userId')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '保存用户策略' })
    saveUserStrategy(
    @CurrentUser()
    currentUser: JwtPayload,
    @Body()
    body: {
        name: string;
        riskLevel?: string;
        trendFollowing?: boolean;
        volatilityPref?: string;
        holdDuration?: string;
        maxBetPercent?: number;
        stopLoss?: number;
        takeProfit?: number;
    }) {
        return this.strategyService.saveUserStrategy(currentUser.sub, body);
    }
    @Delete('user/:userId/:strategyId')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '删除用户策略' })
    deleteUserStrategy(
    @CurrentUser()
    currentUser: JwtPayload,
    @Param('strategyId')
    strategyId: string) {
        return this.strategyService.deleteUserStrategy(currentUser.sub, strategyId);
    }
    @Post('suggest')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '根据策略生成 AI 交易建议' })
    generateSuggestion(
    @CurrentUser()
    currentUser: JwtPayload,
    @Body()
    body: {
        marketId: string;
        strategyId?: string;
        language?: string;
    }) {
        return this.strategyService.generateSuggestion(currentUser.sub, body.marketId, body.strategyId, body.language);
    }
    @Post('suggest-with-model')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '使用指定 AI 模型生成交易建议' })
    generateSuggestionWithModel(
    @CurrentUser()
    currentUser: JwtPayload,
    @Body()
    body: {
        marketId: string;
        strategyId?: string;
        modelId: string;
        language?: string;
        customConfig?: {
            name: string;
            apiKey: string;
            baseUrl: string;
            model: string;
        };
    }) {
        return this.strategyService.generateSuggestionWithModel(currentUser.sub, body.marketId, body.strategyId, body.modelId, body.language, body.customConfig);
    }
    @Post('follow')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '跟随 AI 建议下单' })
    followSuggestion(
    @CurrentUser()
    currentUser: JwtPayload,
    @Body()
    body: {
        suggestionId: string;
    }) {
        return this.strategyService.followSuggestion(currentUser.sub, body.suggestionId);
    }
    @Get('history/:userId')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '获取 AI 建议历史' })
    getSuggestionHistory(
    @CurrentUser()
    currentUser: JwtPayload,
    @Query('limit')
    limit?: number) {
        return this.strategyService.getSuggestionHistory(currentUser.sub, limit || 20);
    }
}
