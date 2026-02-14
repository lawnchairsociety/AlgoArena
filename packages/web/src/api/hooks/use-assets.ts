import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Asset } from '@/types/api';

export function useAssets() {
  return useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data } = await apiClient.get<Asset[]>('/market/assets', {
        params: { status: 'active' },
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
