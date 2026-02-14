import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { CuidUser } from '@/types/api';

export function useUser(cuid: string | null) {
  return useQuery({
    queryKey: ['user', cuid],
    queryFn: async () => {
      const { data } = await apiClient.get<CuidUser>(`/auth/users/${cuid}`);
      return data;
    },
    enabled: !!cuid,
    refetchInterval: 10_000,
  });
}
