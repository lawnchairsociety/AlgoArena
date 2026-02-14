import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { AccountSummary } from '@/types/api';

export function useAccount() {
  return useQuery({
    queryKey: ['account'],
    queryFn: async () => {
      const { data } = await apiClient.get<AccountSummary>('/portfolio/account');
      return data;
    },
    refetchInterval: 10_000,
  });
}
