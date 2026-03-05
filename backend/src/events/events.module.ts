import { Module } from '@nestjs/common';
import { PaymentEventsHandler } from './payment-events.handler';

@Module({
  providers: [PaymentEventsHandler],
})
export class EventsModule {}
