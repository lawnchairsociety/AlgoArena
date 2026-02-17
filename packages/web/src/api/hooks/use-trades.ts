import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { EnhancedTradesResponse } from '@/types/api';

interface UseTradesParams {
  limit?: number;
  offset?: number;
  symbol?: string;
  side?: string;
  startDate?: string;
  endDate?: string;
}

export function useTrades(params: UseTradesParams = {}) {
  return useQuery({
    queryKey: ['trades', params],
    queryFn: async () => {
      const { data } = await apiClient.get<EnhancedTradesResponse>('/portfolio/trades', { params });
      return data;
    },
    refetchInterval: 30_000,
  });
}
