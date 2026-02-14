import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { TradeHistory } from '@/types/api';

interface UseTradesParams {
  limit?: number;
  offset?: number;
  symbol?: string;
}

export function useTrades(params: UseTradesParams = {}) {
  return useQuery({
    queryKey: ['trades', params],
    queryFn: async () => {
      const { data } = await apiClient.get<TradeHistory[]>('/portfolio/trades', { params });
      return data;
    },
    refetchInterval: 30_000,
  });
}
