import { Badge } from '@/components/ui/badge';
import { useUser } from '@/api/hooks/use-user';
import { useMarketClock } from '@/api/hooks/use-market-clock';
import { useCuidStore } from '@/stores/cuid-store';
import { Skeleton } from '@/components/ui/skeleton';
import { User, Clock } from 'lucide-react';

export function DashboardHeader() {
  const cuid = useCuidStore((s) => s.cuid);
  const { data: user, isLoading: userLoading } = useUser(cuid);
  const { data: clock } = useMarketClock();

  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <div className="flex items-center gap-3">
        <User className="h-5 w-5 text-muted-foreground" />
        {userLoading ? (
          <Skeleton className="h-5 w-32" />
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium">{user?.label || 'Unnamed User'}</span>
            <span className="text-xs text-muted-foreground font-mono">
              {cuid ? `${cuid.slice(0, 12)}...` : ''}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        {clock ? (
          <Badge variant={clock.isOpen ? 'default' : 'destructive'} className={clock.isOpen ? 'bg-profit text-background' : ''}>
            Market {clock.isOpen ? 'Open' : 'Closed'}
          </Badge>
        ) : (
          <Skeleton className="h-5 w-20" />
        )}
      </div>
    </header>
  );
}
