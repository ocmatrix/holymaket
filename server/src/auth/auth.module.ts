import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from './jwt.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { QuestService } from '../quest/quest.service';
import { EventsModule } from '../events/events.module';

@Global()
@Module({
    imports: [EventsModule],
    controllers: [AuthController],
    providers: [AuthService, JwtService, JwtAuthGuard, QuestService],
    exports: [AuthService, JwtService, JwtAuthGuard],
})
export class AuthModule {
}
