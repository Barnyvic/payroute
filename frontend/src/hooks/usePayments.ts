import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '../api/payments';
import type { CreatePaymentPayload, ListPaymentsParams } from '../types/payment.types';

export const PAYMENTS_KEY = 'payments';

export function usePaymentList(params: ListPaymentsParams = {}) {
  return useQuery({
    queryKey: [PAYMENTS_KEY, 'list', params],
    queryFn: () => paymentsApi.list(params),
    refetchInterval: (query) => {
      
      const data = query.state.data;
      const hasProcessing = data?.data?.some((t) => t.status === 'processing');
      return hasProcessing ? 10_000 : false;
    },
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: [PAYMENTS_KEY, 'detail', id],
    queryFn: () => paymentsApi.getById(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.transaction?.status;
      return status === 'processing' ? 10_000 : false;
    },
  });
}

export function usePaymentStats() {
  return useQuery({
    queryKey: [PAYMENTS_KEY, 'stats'],
    queryFn: () => paymentsApi.getStats(),
    refetchInterval: 30_000,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: CreatePaymentPayload;
      idempotencyKey: string;
    }) => paymentsApi.create(payload, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY, 'list'] });
    },
  });
}
