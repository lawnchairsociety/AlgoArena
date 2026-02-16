import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { MultiBarsResponse } from '@/types/api';

export function useMultiBars(symbols: string[], timeframe = '1Day', limit = 100) {
  return useQuery({
    queryKey: ['multiBars', symbols, timeframe, limit],
    queryFn: async () => {
      const { data } = await apiClient.get<MultiBarsResponse>('/market/bars', {
        params: { symbols: symbols.join(','), timeframe, limit },
      });
      return data;
    },
    enabled: symbols.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
