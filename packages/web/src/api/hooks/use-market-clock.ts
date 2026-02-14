import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { MarketClock } from '@/types/api';

export function useMarketClock() {
  return useQuery({
    queryKey: ['market-clock'],
    queryFn: async () => {
      const { data } = await apiClient.get<MarketClock>('/market/clock');
      return data;
    },
    refetchInterval: 30_000,
  });
}
