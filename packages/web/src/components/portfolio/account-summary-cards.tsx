import { useAccount } from '@/api/hooks/use-account';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, pnlColor } from '@/lib/format';
import { cn } from '@/lib/utils';

export function AccountSummaryCards() {
  const { data, isLoading } = useAccount();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="mb-2 h-3 w-20" />
              <Skeleton className="h-6 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const items = [
    { label: 'Cash', value: formatCurrency(data.cashBalance) },
    { label: 'Positions Value', value: formatCurrency(data.positionsValue) },
    { label: 'Total Equity', value: formatCurrency(data.totalEquity) },
    { label: 'Unrealized P&L', value: formatCurrency(data.unrealizedPnl), colored: true, raw: data.unrealizedPnl },
    { label: 'Total P&L', value: formatCurrency(data.totalPnl), colored: true, raw: data.totalPnl },
    { label: 'Margin Used', value: formatCurrency(data.marginUsed) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={cn('mt-1 text-lg font-semibold', item.colored && item.raw && pnlColor(item.raw))}>
              {item.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
