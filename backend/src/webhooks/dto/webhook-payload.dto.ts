import { IsString, IsNotEmpty, IsNumber, IsDateString, IsIn, IsOptional } from 'class-validator';

export class WebhookPayloadDto {
  @IsString()
  @IsNotEmpty()
  reference: string;

  @IsString()
  @IsIn(['completed', 'failed', 'processing'])
  status: string;

  @IsNumber()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsDateString()
  @IsOptional()
  timestamp?: string;
}
