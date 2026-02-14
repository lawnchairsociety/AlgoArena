import { useQuote } from '@/api/hooks/use-quote';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';

export function QuoteCard({ symbol }: { symbol: string }) {
  const { data: quote, isLoading } = useQuote(symbol);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{symbol} Quote</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!quote) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{symbol} Quote</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No quote data available</p>
        </CardContent>
      </Card>
    );
  }

  const spread = quote.askPrice - quote.bidPrice;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{symbol} Quote</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Bid</p>
            <p className="text-lg font-semibold text-profit">{formatCurrency(String(quote.bidPrice))}</p>
            <p className="text-xs text-muted-foreground">Size: {quote.bidSize}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ask</p>
            <p className="text-lg font-semibold text-loss">{formatCurrency(String(quote.askPrice))}</p>
            <p className="text-xs text-muted-foreground">Size: {quote.askSize}</p>
          </div>
        </div>
        <div className="mt-3 rounded bg-secondary/50 px-3 py-1.5 text-center text-sm">
          Spread: {formatCurrency(String(spread))}
        </div>
      </CardContent>
    </Card>
  );
}
