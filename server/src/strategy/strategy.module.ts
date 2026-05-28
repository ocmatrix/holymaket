import { Module } from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { StrategyController } from './strategy.controller';
import { PrismaModule } from '../prisma.module';
@Module({
    imports: [PrismaModule],
    providers: [StrategyService],
    controllers: [StrategyController],
    exports: [StrategyService],
})
export class StrategyModule {
}
