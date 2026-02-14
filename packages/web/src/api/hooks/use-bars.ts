import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { BarsResponse } from '@/types/api';

export function useBars(symbol: string | null, timeframe = '1Day', limit = 100) {
  return useQuery({
    queryKey: ['bars', symbol, timeframe, limit],
    queryFn: async () => {
      const { data } = await apiClient.get<BarsResponse>(`/market/bars/${symbol}`, {
        params: { timeframe, limit },
      });
      return data;
    },
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000,
  });
}
