import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  Length,
  IsUppercase,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'NotSelfPayment', async: false })
class NotSelfPaymentConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreatePaymentDto;
    return dto.senderAccountId !== dto.recipientAccountId;
  }

  defaultMessage(): string {
    return 'Sender and recipient accounts must be different';
  }
}

export class CreatePaymentDto {
  @ApiProperty({ example: 'uuid-of-sender-account' })
  @IsUUID()
  senderAccountId: string;

  @ApiProperty({ example: 'uuid-of-recipient-account' })
  @IsUUID()
  @Validate(NotSelfPaymentConstraint)
  recipientAccountId: string;

  @ApiProperty({ example: 'NGN', description: 'ISO 4217 source currency' })
  @IsString()
  @IsNotEmpty()
  @IsUppercase()
  @Length(3, 3)
  sourceCurrency: string;

  @ApiProperty({ example: 'USD', description: 'ISO 4217 destination currency' })
  @IsString()
  @IsNotEmpty()
  @IsUppercase()
  @Length(3, 3)
  destinationCurrency: string;

  @ApiProperty({ example: 500000.0, description: 'Amount in source currency' })
  @IsNumber({ maxDecimalPlaces: 8 })
  @IsPositive()
  amount: number;
}
