import { Module } from '@nestjs/common';
import { AMMService } from './amm.service';
import { AMMController } from './amm.controller';
import { PrismaModule } from '../prisma.module';
@Module({
    imports: [PrismaModule],
    controllers: [AMMController],
    providers: [AMMService],
    exports: [AMMService],
})
export class AMMModule {}
