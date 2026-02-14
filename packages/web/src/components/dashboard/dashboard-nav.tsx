import { Link, useMatches } from '@tanstack/react-router';
import { Briefcase, ClipboardList, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard/$cuid/portfolio' as const, label: 'Portfolio', icon: Briefcase },
  { to: '/dashboard/$cuid/orders' as const, label: 'Orders', icon: ClipboardList },
  { to: '/dashboard/$cuid/market' as const, label: 'Market', icon: BarChart3 },
];

export function DashboardNav({ cuid }: { cuid: string }) {
  const matches = useMatches();
  const currentPath = matches[matches.length - 1]?.fullPath;

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
