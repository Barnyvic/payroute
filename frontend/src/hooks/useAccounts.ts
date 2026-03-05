import { useQuery } from '@tanstack/react-query';
import { accountsApi } from '../api/payments';

export const ACCOUNTS_KEY = 'accounts';

export function useAccounts() {
  return useQuery({
    queryKey: [ACCOUNTS_KEY],
    queryFn: () => accountsApi.list(),
    staleTime: 30000,
  });
}
