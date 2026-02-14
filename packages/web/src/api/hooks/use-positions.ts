import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Position } from '@/types/api';

export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      const { data } = await apiClient.get<Position[]>('/portfolio/positions');
      return data;
    },
    refetchInterval: 10_000,
  });
}
