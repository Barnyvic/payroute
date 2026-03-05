import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FxQuote } from './entities/fx-quote.entity';
import { FxService } from './fx.service';
import { FxController } from './fx.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FxQuote])],
  providers: [FxService],
  controllers: [FxController],
  exports: [FxService],
})
export class FxModule {}
