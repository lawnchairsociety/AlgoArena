import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAccount } from '@/api/hooks/use-account';
import { usePortfolioHistory } from '@/api/hooks/use-portfolio-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';

export function PnlChart() {
  const { data: history, isLoading } = usePortfolioHistory('30d');
  const { data: account } = useAccount();

  const startingBalance = account ? parseFloat(account.startingBalance) : 100_000;

  const chartData = (history?.snapshots || []).map((s) => ({
    date: s.date,
    equity: parseFloat(s.equity),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Equity Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[250px] w-full" />
        ) : chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No history yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(210, 60%, 55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(210, 60%, 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'hsl(215, 15%, 55%)' }}
                tickFormatter={(v: string) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(215, 15%, 55%)' }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222, 25%, 18%)',
                  border: '1px solid hsl(222, 20%, 26%)',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'hsl(210, 20%, 92%)' }}
                labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
                formatter={(value: number) => [formatCurrency(String(value)), 'Equity']}
                cursor={{ fill: 'transparent' }}
              />
              <ReferenceLine y={startingBalance} stroke="hsl(215, 15%, 35%)" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="hsl(210, 60%, 55%)"
                fill="url(#equityGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
