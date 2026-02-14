import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { ActivityDay } from '@/types/api';

export function useActivity(days = 30) {
  return useQuery({
    queryKey: ['activity', days],
    queryFn: async () => {
      const { data } = await apiClient.get<ActivityDay[]>('/stats/activity', {
        params: { days },
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
