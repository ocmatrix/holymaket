import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminService } from './admin.service';
import { AdminAuthService } from './admin-auth.service';
import { MarketModule } from '../market/market.module';
import { EventsModule } from '../events/events.module';
import { QuestModule } from '../quest/quest.module';
@Module({
    imports: [MarketModule, EventsModule, QuestModule],
    controllers: [AdminController, AdminAuthController],
    providers: [AdminService, AdminAuthService],
    exports: [AdminService, AdminAuthService],
})
export class AdminModule {
}
