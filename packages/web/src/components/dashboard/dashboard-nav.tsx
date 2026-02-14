import { Link, useMatches } from '@tanstack/react-router';
import { BarChart3, Briefcase, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard/$cuid/portfolio' as const, label: 'Portfolio', icon: Briefcase },
  { to: '/dashboard/$cuid/orders' as const, label: 'Orders', icon: ClipboardList },
  { to: '/dashboard/$cuid/market' as const, label: 'Market', icon: BarChart3 },
];

interface DashboardNavProps {
  cuid: string;
  variant: 'sidebar' | 'bottom';
}

export function DashboardNav({ cuid, variant }: DashboardNavProps) {
  const matches = useMatches();
  const currentPath = matches[matches.length - 1]?.fullPath;

  if (variant === 'bottom') {
    return (
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = currentPath === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              params={{ cuid }}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-1 text-xs font-medium transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              {item.label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.map((item) => {
        const isActive = currentPath === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            params={{ cuid }}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
