

export class PaymentInitiatedEvent {
  constructor(
    public readonly transactionId: string,
    public readonly senderAccountId: string,
    public readonly sourceAmount: string,
    public readonly sourceCurrency: string,
    public readonly destinationCurrency: string,
    public readonly idempotencyKey: string,
  ) {}
}

export class PaymentCompletedEvent {
  constructor(
    public readonly transactionId: string,
    public readonly recipientAccountId: string,
    public readonly destinationAmount: string,
    public readonly destinationCurrency: string,
    public readonly providerReference: string,
  ) {}
}

export class PaymentFailedEvent {
  constructor(
    public readonly transactionId: string,
    public readonly providerReference: string,
    public readonly reason: string,
  ) {}
}

export class PaymentRefundedEvent {
  constructor(
    public readonly transactionId: string,
    public readonly reason: string,
    public readonly refundedAt: Date,
  ) {}
}
