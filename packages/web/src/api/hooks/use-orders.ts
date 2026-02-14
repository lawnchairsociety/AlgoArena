import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Order } from '@/types/api';

interface UseOrdersParams {
  status?: string;
  symbol?: string;
  limit?: number;
  offset?: number;
}

export function useOrders(params: UseOrdersParams = {}) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: async () => {
      const { data } = await apiClient.get<Order[]>('/trading/orders', { params });
      return data;
    },
    refetchInterval: 10_000,
  });
}

export function useOrder(orderId: string | null) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const { data } = await apiClient.get<Order>(`/trading/orders/${orderId}`);
      return data;
    },
    enabled: !!orderId,
    refetchInterval: 10_000,
  });
}
