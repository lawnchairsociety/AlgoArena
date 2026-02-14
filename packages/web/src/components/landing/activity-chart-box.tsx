import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useActivity } from '@/api/hooks/use-activity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ActivityChartBox() {
  const { data, isLoading } = useActivity(30);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Platform Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[180px] w-full" />
        ) : !data || data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No trading activity yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data}>
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
                allowDecimals={false}
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
                cursor={{ fill: 'transparent' }}
              />
              <Bar dataKey="tradeCount" fill="hsl(210, 60%, 55%)" radius={[3, 3, 0, 0]} name="Trades" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
