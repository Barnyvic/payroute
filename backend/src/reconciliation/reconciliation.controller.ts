import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ReconciliationService } from './reconciliation.service';

@ApiTags('reconciliation')
@SkipThrottle({ global: true, payments: true, strict: true })
@Controller('reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Get()
  @ApiOperation({ summary: 'Run ledger vs account balance reconciliation' })
  @ApiResponse({ status: 200, description: 'Reconciliation result' })
  async run() {
    return this.reconciliationService.runLedgerVsBalanceCheck();
  }
}
