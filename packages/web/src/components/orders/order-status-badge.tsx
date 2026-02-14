import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  filled: 'bg-profit text-background',
  partially_filled: 'bg-yellow-600 text-white',
  pending: 'bg-primary text-primary-foreground',
  cancelled: 'bg-secondary text-muted-foreground',
  expired: 'bg-secondary text-muted-foreground',
  rejected: 'bg-loss text-white',
};

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge className={cn('text-xs', statusStyles[status] || 'bg-secondary')}>{status.replace('_', ' ')}</Badge>;
}
