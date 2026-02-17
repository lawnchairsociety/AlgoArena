import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { RiskControlsResponse } from '@/types/api';

export function useRiskControls() {
  return useQuery({
    queryKey: ['risk-controls'],
    queryFn: async () => {
      const { data } = await apiClient.get<RiskControlsResponse>('/trading/risk-controls');
      return data;
    },
    refetchInterval: 30_000,
  });
}
