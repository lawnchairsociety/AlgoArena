import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDateTime, formatQuantity } from '@/lib/format';
import type { Order } from '@/types/api';
import { OrderStatusBadge } from './order-status-badge';

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
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">Time</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="hidden lg:table-cell">TIF</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Filled</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Avg Fill</TableHead>
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
                    <TableCell className="text-xs hidden md:table-cell">{formatDateTime(order.createdAt)}</TableCell>
                    <TableCell className="font-medium">{order.symbol}</TableCell>
                    <TableCell>
                      <Badge
                        variant={order.side === 'buy' ? 'default' : 'destructive'}
                        className={order.side === 'buy' ? 'bg-profit text-background' : ''}
                      >
                        {order.side}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs hidden sm:table-cell">
                      {order.type.replace('_', ' ')}
                      {order.bracketRole && (
                        <Badge variant="outline" className="ml-1 text-[10px]">
                          {order.bracketRole === 'entry' ? 'bracket' : order.bracketRole.replace('_', ' ')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs uppercase hidden lg:table-cell">{order.timeInForce}</TableCell>
                    <TableCell className="text-right font-mono">{formatQuantity(order.quantity)}</TableCell>
                    <TableCell className="text-right font-mono hidden sm:table-cell">
                      {formatQuantity(order.filledQuantity)}
                    </TableCell>
                    <TableCell className="text-right font-mono hidden md:table-cell">
                      {order.avgFillPrice ? formatCurrency(order.avgFillPrice) : '-'}
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
