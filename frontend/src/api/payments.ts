import { apiClient } from './client';
import type {
  Account,
  Transaction,
  TransactionDetail,
  PaginatedResponse,
  FxPreview,
  PaymentStats,
  CreatePaymentPayload,
  ListPaymentsParams,
} from '../types/payment.types';

export const accountsApi = {
  list: (): Promise<Account[]> =>
    apiClient.get<Account[]>('/accounts').then((r) => r.data),

  getById: (id: string): Promise<Account> =>
    apiClient.get<Account>(`/accounts/${id}`).then((r) => r.data),
};

export const paymentsApi = {
  list: (params: ListPaymentsParams = {}): Promise<PaginatedResponse<Transaction>> =>
    apiClient
      .get<PaginatedResponse<Transaction>>('/payments', { params })
      .then((r) => r.data),

  getById: (id: string): Promise<TransactionDetail> =>
    apiClient.get<TransactionDetail>(`/payments/${id}`).then((r) => r.data),

  create: (
    payload: CreatePaymentPayload,
    idempotencyKey: string,
  ): Promise<Transaction> =>
    apiClient
      .post<Transaction>('/payments', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      .then((r) => r.data),

  refund: (id: string, reason: string): Promise<Transaction> =>
    apiClient
      .post<Transaction>(`/payments/${id}/refund`, { reason })
      .then((r) => r.data),

  getStats: (): Promise<PaymentStats> =>
    apiClient.get<PaymentStats>('/payments/stats').then((r) => r.data),
};

export const fxApi = {
  getPreview: (
    fromCurrency: string,
    toCurrency: string,
    amount: number,
  ): Promise<FxPreview> =>
    apiClient
      .get<FxPreview>('/fx/quote', {
        params: { fromCurrency, toCurrency, amount },
      })
      .then((r) => r.data),
};
