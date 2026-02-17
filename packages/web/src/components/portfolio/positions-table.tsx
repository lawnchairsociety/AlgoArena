import { usePositions } from '@/api/hooks/use-positions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatQuantity, pnlColor } from '@/lib/format';
import { cn } from '@/lib/utils';

export function PositionsTable() {
  const { data: positions, isLoading } = usePositions();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Positions</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !positions || positions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No open positions</p>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Avg Cost</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Price</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Market Value</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((pos) => (
                  <TableRow key={pos.id}>
                    <TableCell className="font-medium">
                      <div>{pos.symbol}</div>
                      {pos.assetClass === 'option' && (
                        <div className="text-xs text-muted-foreground">
                          {pos.underlyingSymbol} {pos.strikePrice} {pos.optionType} {pos.expiration}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={pos.side === 'long' ? 'default' : 'destructive'}
                        className={pos.side === 'long' ? 'bg-profit text-background' : ''}
                      >
                        {pos.side}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatQuantity(pos.quantity)}</TableCell>
                    <TableCell className="text-right font-mono hidden sm:table-cell">
                      {formatCurrency(pos.avgCostBasis)}
                    </TableCell>
                    <TableCell className="text-right font-mono hidden sm:table-cell">
                      {formatCurrency(pos.currentPrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono hidden md:table-cell">
                      {formatCurrency(pos.marketValue)}
                    </TableCell>
                    <TableCell className={cn('text-right font-mono', pnlColor(pos.unrealizedPnl))}>
                      {formatCurrency(pos.unrealizedPnl)}
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
