import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { AnalyticsPeriod, HistoryResponse } from '@/types/api';

export function usePortfolioHistory(period: AnalyticsPeriod = '30d') {
  return useQuery({
    queryKey: ['portfolio-history', period],
    queryFn: async () => {
      const { data } = await apiClient.get<HistoryResponse>('/portfolio/history', {
        params: { period },
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
