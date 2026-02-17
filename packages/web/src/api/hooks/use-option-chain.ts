import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { OptionChainResponse } from '@/types/api';

export function useOptionChain(
  symbol: string | null,
  params?: { expiration?: string; type?: string; strike_price_gte?: string; strike_price_lte?: string },
) {
  return useQuery({
    queryKey: ['optionChain', symbol, params],
    queryFn: async () => {
      const { data } = await apiClient.get<OptionChainResponse>(
        `/market/options/chain/${encodeURIComponent(symbol!)}`,
        { params },
      );
      return data;
    },
    enabled: !!symbol,
    refetchInterval: 30_000,
  });
}
