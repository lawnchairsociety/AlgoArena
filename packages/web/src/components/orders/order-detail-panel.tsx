import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { OrderStatusBadge } from './order-status-badge';
import { useOrder } from '@/api/hooks/use-orders';
import { formatCurrency, formatQuantity, formatDateTime } from '@/lib/format';

export function OrderDetailPanel({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data: order, isLoading } = useOrder(orderId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!order) return null;

  const details = [
    { label: 'Symbol', value: order.symbol },
    { label: 'Side', value: order.side },
    { label: 'Type', value: order.type.replace('_', ' ') },
    { label: 'Time in Force', value: order.timeInForce.toUpperCase() },
    { label: 'Quantity', value: formatQuantity(order.quantity) },
    { label: 'Filled Qty', value: formatQuantity(order.filledQuantity) },
    { label: 'Limit Price', value: order.limitPrice ? formatCurrency(order.limitPrice) : '-' },
    { label: 'Stop Price', value: order.stopPrice ? formatCurrency(order.stopPrice) : '-' },
    { label: 'Avg Fill Price', value: order.avgFillPrice ? formatCurrency(order.avgFillPrice) : '-' },
    { label: 'Created', value: formatDateTime(order.createdAt) },
  ];

  if (order.rejectionReason) {
    details.push({ label: 'Rejection Reason', value: order.rejectionReason });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Order Detail</CardTitle>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {details.map((d) => (
            <div key={d.label} className="flex justify-between">
              <span className="text-muted-foreground">{d.label}</span>
              <span className="font-mono">{d.value}</span>
            </div>
          ))}
        </div>

        {order.fills && order.fills.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-2 text-sm font-medium">Fills</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.fills.map((fill) => (
                    <TableRow key={fill.id}>
                      <TableCell className="text-xs">{formatDateTime(fill.filledAt)}</TableCell>
                      <TableCell className="text-right font-mono">{formatQuantity(fill.quantity)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(fill.price)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(fill.totalCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
