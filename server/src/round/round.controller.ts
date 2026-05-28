import { Controller, Get, Query } from '@nestjs/common';
import { RoundService } from './round.service';
@Controller('round')
export class RoundController {
    constructor(private readonly roundService: RoundService) { }
    @Get('current')
    async getCurrentRound(
    @Query('category')
    category: string = 'C10') {
        const round = await this.roundService.getCurrentRound(category);
        if (!round) {
            return { success: false, error: 'No active round' };
        }
        return { success: true, round };
    }
    @Get('history')
    async getRoundHistory(
    @Query('category')
    category: string = 'C10', 
    @Query('limit')
    limit: string = '50') {
        const rounds = await this.roundService.getRoundHistory(category, parseInt(limit) || 50);
        return { success: true, rounds };
    }
    @Get('config')
    async getConfig() {
        const config = this.roundService.getConfig();
        return { success: true, config };
    }
    @Get('live-feed')
    async getLiveFeed(
    @Query('category')
    category: string = 'C10', 
    @Query('limit')
    limit: string = '20') {
        const feed = await this.roundService.getLiveFeed(category, parseInt(limit) || 20);
        return { success: true, feed };
    }
    @Get('active-orders')
    async getGlobalActiveOrders(
    @Query('limit')
    limit: string = '50') {
        const orders = await this.roundService.getGlobalActiveOrders(parseInt(limit) || 50);
        return { success: true, orders };
    }
    @Get('settled-orders')
    async getGlobalSettledOrders(
    @Query('limit')
    limit: string = '50') {
        const orders = await this.roundService.getGlobalSettledOrders(parseInt(limit) || 50);
        return { success: true, orders };
    }
}
