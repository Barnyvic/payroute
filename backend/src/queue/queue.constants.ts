export const PROVIDER_QUEUE = 'payment-provider';
export const WEBHOOK_QUEUE = 'webhook-processing';

export const PROVIDER_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: 100,
  removeOnFail: false,
};

export const WEBHOOK_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: 100,
  removeOnFail: false,
};
