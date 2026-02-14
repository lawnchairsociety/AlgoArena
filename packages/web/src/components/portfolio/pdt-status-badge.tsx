import { useAccount } from '@/api/hooks/use-account';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function PdtStatusBadge() {
  const { data } = useAccount();

  if (!data || !data.pdtEnforced) return null;

  const count = data.dayTradeCount;
  const color = count >= 3 ? 'bg-loss text-white' : count >= 2 ? 'bg-yellow-600 text-white' : 'bg-secondary';

  return <Badge className={cn('text-xs', color)}>Day Trades: {count}/3</Badge>;
}
