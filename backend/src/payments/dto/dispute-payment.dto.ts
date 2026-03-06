import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class DisputePaymentDto {
  @ApiProperty({ example: 'Recipient did not receive funds', description: 'Reason for the dispute' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
