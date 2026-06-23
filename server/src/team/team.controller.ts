import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { TeamService } from './team.service';
import { ApiTags, ApiOperation, ApiBody, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.service';
@ApiTags('team')
@Controller('team')
export class TeamController {
    constructor(private readonly teamService: TeamService) { }
    @Get('my/:userId')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '获取我的团队详情' })
    async getMyTeam(
    @CurrentUser()
    currentUser: JwtPayload) {
        return this.teamService.getMyTeam(currentUser.sub);
    }
    @Post('create')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '创建新团队' })
    @ApiBody({ schema: {
            type: 'object',
            properties: {
                userId: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                isPublic: { type: 'boolean', default: true }
            }
        } })
    async createTeam(
    @CurrentUser()
    currentUser: JwtPayload,
    @Body()
    body: {
        name: string;
        description: string;
        isPublic?: boolean;
    }) {
        return this.teamService.createTeam(currentUser.sub, body.name, body.description, body.isPublic);
    }
    @Post('join/invite')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '通过邀请码加入团队' })
    @ApiBody({ schema: {
            type: 'object',
            properties: {
                userId: { type: 'string' },
                inviteCode: { type: 'string' }
            }
        } })
    async joinByInviteCode(
    @CurrentUser()
    currentUser: JwtPayload,
    @Body()
    body: {
        inviteCode: string;
    }) {
        return this.teamService.joinTeamByInviteCode(currentUser.sub, body.inviteCode);
    }
    @Post('join/public')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '加入公开团队' })
    @ApiBody({ schema: {
            type: 'object',
            properties: {
                userId: { type: 'string' },
                teamId: { type: 'string' }
            }
        } })
    async joinPublicTeam(
    @CurrentUser()
    currentUser: JwtPayload,
    @Body()
    body: {
        teamId: string;
    }) {
        return this.teamService.joinPublicTeam(currentUser.sub, body.teamId);
    }
    @Post('leave')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '离开当前团队' })
    @ApiBody({ schema: {
            type: 'object',
            properties: {
                userId: { type: 'string' }
            }
        } })
    async leaveTeam(
    @CurrentUser()
    currentUser: JwtPayload) {
        return this.teamService.leaveTeam(currentUser.sub);
    }
    @Post('transfer-leadership')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '转让队长权限' })
    @ApiBody({ schema: {
            type: 'object',
            properties: {
                currentLeaderId: { type: 'string' },
                newLeaderId: { type: 'string' }
            }
        } })
    async transferLeadership(
    @CurrentUser()
    currentUser: JwtPayload,
    @Body()
    body: {
        newLeaderId: string;
    }) {
        return this.teamService.transferLeadership(currentUser.sub, body.newLeaderId);
    }
    @Post('kick')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '踢出团队成员（仅队长）' })
    @ApiBody({ schema: {
            type: 'object',
            properties: {
                leaderId: { type: 'string' },
                memberId: { type: 'string' }
            }
        } })
    async kickMember(
    @CurrentUser()
    currentUser: JwtPayload,
    @Body()
    body: {
        memberId: string;
    }) {
        return this.teamService.kickMember(currentUser.sub, body.memberId);
    }
    @Post('refresh-invite-code')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '刷新邀请码（仅队长）' })
    @ApiBody({ schema: {
            type: 'object',
            properties: {
                leaderId: { type: 'string' }
            }
        } })
    async refreshInviteCode(
    @CurrentUser()
    currentUser: JwtPayload) {
        return this.teamService.refreshInviteCode(currentUser.sub);
    }
    @Get('search')
    @ApiOperation({ summary: '搜索公开团队' })
    @ApiQuery({ name: 'q', description: '搜索关键词' })
    @ApiQuery({ name: 'limit', description: '返回数量限制', required: false })
    async searchTeams(
    @Query('q')
    query: string, 
    @Query('limit')
    limit?: string) {
        return this.teamService.searchPublicTeams(query, limit ? parseInt(limit) : 10);
    }
    @Get('leaderboard')
    @ApiOperation({ summary: '获取团队排行榜' })
    async getTeamLeaderboard() {
        return this.teamService.getTeamLeaderboard();
    }
}
