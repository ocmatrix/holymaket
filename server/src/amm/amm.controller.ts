import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PositionSide } from '@prisma/client';
import { AMMService } from './amm.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.service';

@ApiTags('amm')
@Controller('amm')
export class AMMController {
    constructor(private readonly ammService: AMMService) {}

    @Get('pool/:roundId')
    @ApiOperation({ summary: '获取流动性池' })
    getPool(@Param('roundId') roundId: string) {
        return this.ammService.getPool(roundId);
    }

    @Get('prices/:roundId')
    @ApiOperation({ summary: '获取 AMM 价格' })
    async getPrices(@Param('roundId') roundId: string) {
        const p = await this.ammService.getPrices(roundId);
        return { success: true, ...p };
    }

    @Post('quote/buy')
    @ApiOperation({ summary: '买入询价' })
    quoteBuy(
        @Body() body: { roundId: string; side: 'YES' | 'NO'; amount: number },
    ) {
        return this.ammService.quoteBuy(body.roundId, body.side as PositionSide, body.amount);
    }

    @Post('quote/sell')
    @ApiOperation({ summary: '卖出询价' })
    quoteSell(
        @Body() body: { roundId: string; side: 'YES' | 'NO'; shares: number },
    ) {
        return this.ammService.quoteSell(body.roundId, body.side as PositionSide, body.shares);
    }

    @Post('buy')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '执行买入' })
    buy(
        @CurrentUser() currentUser: JwtPayload,
        @Body()
        body: {
            roundId: string;
            side: 'YES' | 'NO';
            amount: number;
        },
    ) {
        return this.ammService.executeBuy(
            body.roundId,
            currentUser.sub,
            body.side as PositionSide,
            body.amount,
        );
    }

    @Post('sell')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '执行卖出' })
    sell(
        @CurrentUser() currentUser: JwtPayload,
        @Body()
        body: {
            roundId: string;
            side: 'YES' | 'NO';
            shares: number;
        },
    ) {
        return this.ammService.executeSell(
            body.roundId,
            currentUser.sub,
            body.side as PositionSide,
            body.shares,
        );
    }

    @Get('positions/:userId')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '用户持仓' })
    getPositions(
        @CurrentUser() currentUser: JwtPayload,
        @Query('roundId') roundId?: string,
    ) {
        return this.ammService.getUserPositions(currentUser.sub, roundId);
    }

    @Get('trades/:roundId')
    @ApiOperation({ summary: '成交记录' })
    getTrades(
        @Param('roundId') roundId: string,
        @Query('limit') limit?: string,
    ) {
        const n = limit ? parseInt(limit, 10) : 100;
        return this.ammService.getTrades(roundId, Number.isNaN(n) ? 100 : n);
    }

    @Get('candles/:roundId')
    @ApiOperation({ summary: 'K 线' })
    getCandles(
        @Param('roundId') roundId: string,
        @Query('interval') interval: '1s' | '5s' | '1m' = '5s',
        @Query('limit') limit?: string,
    ) {
        const n = limit ? parseInt(limit, 10) : 100;
        return this.ammService.getPriceCandles(
            roundId,
            interval,
            Number.isNaN(n) ? 100 : n,
        );
    }
}
