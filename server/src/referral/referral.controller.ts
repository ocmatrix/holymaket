import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ReferralService } from './referral.service';
import { AdminTokenGuard } from '../auth/guards/admin-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.service';
@ApiTags('referral')
@Controller('referral')
export class ReferralController {
    constructor(private readonly referralService: ReferralService) { }
    @Get('admin/stats')
    @UseGuards(AdminTokenGuard)
    @ApiOperation({ summary: '[管理员] 全局推荐统计' })
    async getAdminStats() {
        return this.referralService.getGlobalReferralStats();
    }
    @Get('admin/top')
    @UseGuards(AdminTokenGuard)
    @ApiOperation({ summary: '[管理员] 推荐人排行榜' })
    @ApiQuery({ name: 'limit', required: false, description: '数量，默认 20' })
    async getAdminTop(
    @Query('limit')
    limit?: string) {
        const n = limit ? parseInt(limit, 10) : 20;
        return this.referralService.getTopReferrers(isNaN(n) ? 20 : n);
    }
    @Get('stats/:userId')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '获取用户推荐统计数据' })
    @ApiParam({ name: 'userId', description: '用户 ID' })
    async getStats(
    @CurrentUser()
    currentUser: JwtPayload) {
        return this.referralService.getReferralStats(currentUser.sub);
    }
    @Get('list/:userId')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '获取用户推荐的用户列表' })
    @ApiParam({ name: 'userId', description: '用户 ID' })
    @ApiQuery({ name: 'page', required: false, description: '页码，默认 1' })
    @ApiQuery({ name: 'limit', required: false, description: '每页数量，默认 20' })
    async getList(
    @CurrentUser()
    currentUser: JwtPayload,
    @Query('page')
    page?: string, 
    @Query('limit')
    limit?: string) {
        return this.referralService.getReferralList(currentUser.sub, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
    }
    @Get('rewards/:userId')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '获取用户推荐奖励明细' })
    @ApiParam({ name: 'userId', description: '用户 ID' })
    @ApiQuery({ name: 'page', required: false, description: '页码，默认 1' })
    @ApiQuery({ name: 'limit', required: false, description: '每页数量，默认 20' })
    async getRewards(
    @CurrentUser()
    currentUser: JwtPayload,
    @Query('page')
    page?: string, 
    @Query('limit')
    limit?: string) {
        return this.referralService.getRewardHistory(currentUser.sub, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
    }
}
