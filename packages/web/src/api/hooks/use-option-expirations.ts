import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

export function useOptionExpirations(symbol: string | null) {
  return useQuery({
    queryKey: ['optionExpirations', symbol],
    queryFn: async () => {
      const { data } = await apiClient.get<{ symbol: string; expirations: string[] }>(
        `/market/options/expirations/${encodeURIComponent(symbol!)}`,
      );
      return data;
    },
    enabled: !!symbol,
    refetchInterval: 30_000,
  });
}
