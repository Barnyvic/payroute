import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  createParamDecorator,
  ExecutionContext,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';

export const IdempotencyKeyHeader = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['idempotency-key'] || request.idempotencyKey;
  },
);

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  @Throttle({ payments: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Initiate a cross-border payment' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key to prevent duplicate payments (UUID recommended)',
    required: true,
  })
  @ApiResponse({ status: 201, description: 'Payment initiated' })
  @ApiResponse({ status: 400, description: 'Validation error or insufficient funds' })
  @ApiResponse({ status: 409, description: 'Account locked by concurrent transaction' })
  @ApiResponse({ status: 429, description: 'Too many requests — throttle limit exceeded' })
  async createPayment(@Body() dto: CreatePaymentDto, @IdempotencyKeyHeader() key: string) {
    return this.paymentsService.createPayment(dto, key);
  }

  @Get()
  @ApiOperation({ summary: 'List payments with pagination and filters' })
  findAll(@Query() query: ListPaymentsDto) {
    return this.paymentsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Operational statistics',
    description:
      'Per-status transaction counts, total source volume per status, and count of stuck ' +
      'PROCESSING payments (>30 min with no provider reference). Used by the ops dashboard.',
  })
  @ApiResponse({ status: 200, description: 'Aggregate payment statistics' })
  getStats() {
    return this.paymentsService.getStats();
  }

  @Get('stuck')
  @ApiOperation({
    summary: 'List stuck PROCESSING payments',
    description:
      'Returns PROCESSING transactions older than `thresholdMinutes` (default 30) with no ' +
      'provider reference. These require manual review or an automated recovery job.',
  })
  @ApiResponse({ status: 200, description: 'List of stuck transactions' })
  findStuck(
    @Query('thresholdMinutes', new DefaultValuePipe(30), ParseIntPipe) thresholdMinutes: number,
  ) {
    return this.paymentsService.findStuck(thresholdMinutes);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment details including ledger entries and state history' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findById(id);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @Throttle({ strict: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Refund / reverse a payment',
    description: [
      'Allowed on PROCESSING (stuck), FAILED (manual reversal), and COMPLETED (chargeback) transactions.',
      'PROCESSING / FAILED → compensating ledger entries restore the sender balance → REVERSED.',
      'COMPLETED → full chargeback: debit recipient, credit sender at original rate → REVERSED.',
    ].join(' '),
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Transaction ID' })
  @ApiBody({ type: RefundPaymentDto })
  @ApiResponse({ status: 200, description: 'Payment reversed' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({ status: 409, description: 'Transaction status does not permit refund' })
  async refundPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundPaymentDto,
  ) {
    return this.paymentsService.refundPayment(id, dto);
  }
}
