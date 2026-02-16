import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Quote } from '@/types/api';

export function useQuote(symbol: string | null) {
  return useQuery({
    queryKey: ['quote', symbol],
    queryFn: async () => {
      const { data } = await apiClient.get<Quote>(`/market/quotes/${encodeURIComponent(symbol!)}`);
      return data;
    },
    enabled: !!symbol,
    refetchInterval: 5_000,
  });
}

export function useQuotes(symbols: string[]) {
  return useQuery({
    queryKey: ['quotes', symbols],
    queryFn: async () => {
      const { data } = await apiClient.get<Record<string, Quote>>('/market/quotes', {
        params: { symbols: symbols.join(',') },
      });
      return data;
    },
    enabled: symbols.length > 0,
    refetchInterval: 5_000,
  });
}
