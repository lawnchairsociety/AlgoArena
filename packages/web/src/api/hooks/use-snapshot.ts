import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Bar, Quote } from '@/types/api';

interface Snapshot {
  latestTrade: { timestamp: string; price: number; size: number };
  latestQuote: Quote;
  minuteBar: Bar;
  dailyBar: Bar;
  prevDailyBar: Bar;
}

export function useSnapshot(symbol: string | null) {
  return useQuery({
    queryKey: ['snapshot', symbol],
    queryFn: async () => {
      const { data } = await apiClient.get<Snapshot>(`/market/snapshots/${encodeURIComponent(symbol!)}`);
      return data;
    },
    enabled: !!symbol,
    refetchInterval: 5_000,
  });
}
