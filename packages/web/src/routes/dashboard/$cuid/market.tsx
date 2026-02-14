import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { SymbolSearch } from '@/components/market/symbol-search';
import { QuoteCard } from '@/components/market/quote-card';
import { PriceChart } from '@/components/market/price-chart';

export const Route = createFileRoute('/dashboard/$cuid/market')({
  component: MarketPage,
});

function MarketPage() {
  const [symbol, setSymbol] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Market Data</h2>
        <SymbolSearch value={symbol} onChange={setSymbol} />
      </div>
      {symbol ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <QuoteCard symbol={symbol} />
          </div>
          <div className="lg:col-span-2">
            <PriceChart symbol={symbol} />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-24">
          <p className="text-muted-foreground">Search for a symbol to view market data</p>
        </div>
      )}
    </div>
  );
}
