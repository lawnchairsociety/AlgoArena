import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderStatusBadge } from './order-status-badge';
import type { Order } from '@/types/api';
import { formatCurrency, formatQuantity, formatDateTime } from '@/lib/format';

interface OrdersTableProps {
  orders: Order[] | undefined;
  isLoading: boolean;
  selectedOrderId: string | null;
  onSelectOrder: (id: string | null) => void;
}

export function OrdersTable({ orders, isLoading, selectedOrderId, onSelectOrder }: OrdersTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Orders</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !orders || orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No orders found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>TIF</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Filled</TableHead>
                <TableHead className="text-right">Avg Fill</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.id}
                  className={`cursor-pointer ${selectedOrderId === order.id ? 'bg-muted/80' : ''}`}
                  onClick={() => onSelectOrder(selectedOrderId === order.id ? null : order.id)}
                >
                  <TableCell className="text-xs">{formatDateTime(order.createdAt)}</TableCell>
                  <TableCell className="font-medium">{order.symbol}</TableCell>
                  <TableCell>
                    <Badge variant={order.side === 'buy' ? 'default' : 'destructive'} className={order.side === 'buy' ? 'bg-profit text-background' : ''}>
                      {order.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{order.type.replace('_', ' ')}</TableCell>
                  <TableCell className="text-xs uppercase">{order.timeInForce}</TableCell>
                  <TableCell className="text-right font-mono">{formatQuantity(order.quantity)}</TableCell>
                  <TableCell className="text-right font-mono">{formatQuantity(order.filledQuantity)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {order.avgFillPrice ? formatCurrency(order.avgFillPrice) : '-'}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
