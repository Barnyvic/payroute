import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RefundPaymentDto {
  @ApiProperty({ example: 'Provider failed — manual reversal', description: 'Reason for the refund' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
