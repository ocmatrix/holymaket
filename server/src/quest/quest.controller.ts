import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { QuestService } from './quest.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.service';
@ApiTags('quest')
@Controller('quest')
export class QuestController {
    constructor(private readonly questService: QuestService) { }
    @Get('tasks/:userId')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '获取用户所有任务及进度' })
    getTasks(
    @CurrentUser()
    currentUser: JwtPayload) {
        return this.questService.getTasks(currentUser.sub);
    }
    @Post('claim')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: '领取任务奖励' })
    claimReward(
    @CurrentUser()
    currentUser: JwtPayload,
    @Body()
    body: {
        taskId: string;
    }) {
        return this.questService.claimReward(currentUser.sub, body.taskId);
    }
}
