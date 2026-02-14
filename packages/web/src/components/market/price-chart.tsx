import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBars } from '@/api/hooks/use-bars';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/lib/format';

const timeframes = [
  { label: '1D', value: '1Day' },
  { label: '1H', value: '1Hour' },
  { label: '15m', value: '15Min' },
];

export function PriceChart({ symbol }: { symbol: string }) {
  const [timeframe, setTimeframe] = useState('1Day');
  const { data, isLoading } = useBars(symbol, timeframe);

  const chartData = (data?.bars || []).map((bar) => ({
    time: bar.timestamp,
    close: bar.close,
    volume: bar.volume,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{symbol} Price</CardTitle>
        <div className="flex gap-1">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                timeframe === tf.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No bar data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: 'hsl(215, 15%, 55%)' }}
                tickFormatter={(v: string) => {
                  const d = new Date(v);
                  return timeframe === '1Day'
                    ? `${d.getMonth() + 1}/${d.getDate()}`
                    : `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="price"
                orientation="right"
                tick={{ fontSize: 11, fill: 'hsl(215, 15%, 55%)' }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              />
              <YAxis
                yAxisId="volume"
                orientation="left"
                tick={{ fontSize: 11, fill: 'hsl(215, 15%, 55%)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => {
                  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
                  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
                  return String(v);
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222, 25%, 18%)',
                  border: '1px solid hsl(222, 20%, 26%)',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'hsl(210, 20%, 92%)' }}
                labelFormatter={(label: string) => new Date(label).toLocaleString()}
                formatter={(value: number, name: string) => {
                  if (name === 'close') return [formatCurrency(String(value)), 'Price'];
                  return [value.toLocaleString(), 'Volume'];
                }}
              />
              <Bar yAxisId="volume" dataKey="volume" fill="hsl(222, 20%, 26%)" opacity={0.5} />
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="close"
                stroke="hsl(210, 60%, 55%)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
