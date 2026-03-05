import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn, IsNumber } from 'class-validator';

class SimulateWebhookDto {
  @IsString()
  @IsNotEmpty()
  providerReference: string;

  @IsString()
  @IsIn(['completed', 'failed'])
  status: string;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string;
}


@ApiTags('simulate')
@Controller('simulate')
export class ProviderController {
  private readonly logger = new Logger(ProviderController.name);

  @Post('webhook')
  @ApiOperation({
    summary: 'Simulate a provider webhook callback (test only)',
    description: 'Triggers a fake completed/failed callback for a given provider reference',
  })
  async simulateWebhook(
    @Body() dto: SimulateWebhookDto,
    @Headers() headers: Record<string, string>,
  ) {
    this.logger.log(
      `Simulation: provider webhook triggered for ${dto.providerReference} → ${dto.status}`,
    );
    
    
    return {
      message: 'Simulation note: POST to /api/webhooks/provider with the body below',
      webhookBody: {
        reference: dto.providerReference,
        status: dto.status,
        amount: dto.amount,
        currency: dto.currency,
        timestamp: new Date().toISOString(),
      },
      webhookUrl: '/api/webhooks/provider',
    };
  }
}
