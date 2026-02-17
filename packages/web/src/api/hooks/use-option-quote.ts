import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { OptionQuote } from '@/types/api';

export function useOptionQuote(contractSymbol: string | null) {
  return useQuery({
    queryKey: ['optionQuote', contractSymbol],
    queryFn: async () => {
      const { data } = await apiClient.get<OptionQuote>(
        `/market/options/quotes/${encodeURIComponent(contractSymbol!)}`,
      );
      return data;
    },
    enabled: !!contractSymbol,
    refetchInterval: 5_000,
  });
}
