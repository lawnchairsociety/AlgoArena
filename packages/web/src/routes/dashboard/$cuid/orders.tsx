import { createFileRoute } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useOrders } from '@/api/hooks/use-orders';
import { OrderDetailPanel } from '@/components/orders/order-detail-panel';
import { OrderFilters } from '@/components/orders/order-filters';
import { OrdersTable } from '@/components/orders/orders-table';

export const Route = createFileRoute('/dashboard/$cuid/orders')({
  component: OrdersPage,
});

function OrdersPage() {
  const [status, setStatus] = useState('all');
  const [symbol, setSymbol] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const deferredSymbol = useDeferredValue(symbol);

  const { data: orders, isLoading } = useOrders({
    status: status === 'all' ? undefined : status,
    symbol: deferredSymbol || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Orders</h2>
        <OrderFilters status={status} symbol={symbol} onStatusChange={setStatus} onSymbolChange={setSymbol} />
      </div>
      <OrdersTable
        orders={orders}
        isLoading={isLoading}
        selectedOrderId={selectedOrderId}
        onSelectOrder={setSelectedOrderId}
      />
      {selectedOrderId && <OrderDetailPanel orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />}
    </div>
  );
}
