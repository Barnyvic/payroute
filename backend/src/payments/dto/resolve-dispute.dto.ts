import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ResolveDisputeDto {
  @ApiProperty({
    enum: ['reverse', 'reject'],
    description: 'Reverse = refund sender (chargeback). Reject = keep payment completed.',
  })
  @IsIn(['reverse', 'reject'])
  action: 'reverse' | 'reject';
}
