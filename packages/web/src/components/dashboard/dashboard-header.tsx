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
    <header className="flex items-center justify-between border-b px-4 py-3 md:px-6">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <User className="h-5 w-5 shrink-0 text-muted-foreground" />
        {userLoading ? (
          <Skeleton className="h-5 w-32" />
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">{user?.label || 'Unnamed User'}</span>
            <span className="hidden sm:inline text-xs text-muted-foreground font-mono">
              {cuid ? `${cuid.slice(0, 12)}...` : ''}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Clock className="h-4 w-4 text-muted-foreground hidden sm:block" />
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
