import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AIService } from './ai.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.service';
@ApiTags('ai')
@Controller('ai')
export class AIController {
    constructor(private readonly aiService: AIService) { }
    @Get('status')
    @ApiOperation({ summary: '获取 AI 服务状态' })
    getStatus() {
        return this.aiService.getStatus();
    }
    @Get('landing-suggestion')
    @ApiOperation({ summary: '落地页真 AI 建议（一句通用洞察，fresh=1 每次重新生成并带平台/热门市场上下文）' })
    getLandingSuggestion(
    @Query('language')
    language?: string, 
    @Query('fresh')
    fresh?: string) {
        return this.aiService.getLandingSuggestion(language || 'zh-CN', fresh === '1');
    }
    @Get('analyze/:marketId')
    @ApiOperation({ summary: '获取 AI 市场分析' })
    async analyzeMarket(
    @Param('marketId')
    marketId: string) {
        return this.aiService.analyzeMarket(marketId);
    }
    @Post('chat')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'AI 问答' })
    async chat(
    @CurrentUser()
    currentUser: JwtPayload,
    @Body()
    body: {
        question: string;
        marketId?: string;
    }) {
        return this.aiService.chat(currentUser.sub, body.question, {
            marketId: body.marketId
        });
    }
    @Post('battle-strategy')
    @ApiOperation({ summary: '生成 AI 对战策略' })
    async getBattleStrategy(
    @Body()
    body: {
        agentPersonality: string;
        marketId: string;
    }) {
        const context = await this.aiService.getMarketContext(body.marketId);
        return this.aiService.generateBattleStrategy(body.agentPersonality, context);
    }
}
