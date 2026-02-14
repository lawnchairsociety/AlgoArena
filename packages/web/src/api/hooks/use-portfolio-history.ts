import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { PortfolioSnapshot } from '@/types/api';

export function usePortfolioHistory(days = 30) {
  return useQuery({
    queryKey: ['portfolio-history', days],
    queryFn: async () => {
      const { data } = await apiClient.get<PortfolioSnapshot[]>('/portfolio/history', {
        params: { days },
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
