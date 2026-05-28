import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { MarketModule } from './market/market.module';
import { PlaygroundModule } from './playground/playground.module';
import { QuestModule } from './quest/quest.module';
import { TeamModule } from './team/team.module';
import { AuthModule } from './auth/auth.module';
import { AIModule } from './ai/ai.module';
import { StrategyModule } from './strategy/strategy.module';
import { AdminModule } from './admin/admin.module';
import { SeasonModule } from './season/season.module';
import { RoundModule } from './round/round.module';
import { AMMModule } from './amm/amm.module';
import { ReferralModule } from './referral/referral.module';
import { NotificationModule } from './notification/notification.module';
import { AppConfigModule } from './config/config.module';
import { EsportsModule } from './esports/esports.module';
import { FootballModule } from './football/football.module';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma.module';
import { EventsModule } from './events/events.module';
@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ScheduleModule.forRoot(),
        ThrottlerModule.forRoot([{
                name: 'short',
                ttl: 1000,
                limit: 10,
            }, {
                name: 'medium',
                ttl: 10000,
                limit: 50,
            }, {
                name: 'long',
                ttl: 60000,
                limit: 100,
            }]),
        PrismaModule,
        EventsModule,
        MarketModule,
        PlaygroundModule,
        QuestModule,
        TeamModule,
        AuthModule,
        AIModule,
        StrategyModule,
        AdminModule,
        SeasonModule,
        RoundModule,
        AMMModule,
        ReferralModule,
        NotificationModule,
        AppConfigModule,
        EsportsModule,
        FootballModule,
        UserModule,
    ],
    controllers: [],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule {
}
