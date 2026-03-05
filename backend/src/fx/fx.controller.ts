import { Controller, Get, Query, ParseFloatPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { FxService } from './fx.service';

@ApiTags('fx')
@SkipThrottle({ global: true, payments: true, strict: true })
@Controller('fx')
export class FxController {
  constructor(private readonly fxService: FxService) {}

  @Get('quote')
  @ApiOperation({ summary: 'Preview FX rate without creating a quote (Redis-cached, 60s TTL)' })
  @ApiQuery({ name: 'fromCurrency', example: 'NGN' })
  @ApiQuery({ name: 'toCurrency', example: 'USD' })
  @ApiQuery({ name: 'amount', example: 500000 })
  getQuotePreview(
    @Query('fromCurrency') fromCurrency: string,
    @Query('toCurrency') toCurrency: string,
    @Query('amount', ParseFloatPipe) amount: number,
  ) {
    return this.fxService.getPreview(fromCurrency, toCurrency, amount);
  }
}
