import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useCuidStore } from '@/stores/cuid-store';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { useUser } from '@/api/hooks/use-user';

export const Route = createFileRoute('/dashboard/$cuid')({
  component: DashboardRoute,
});

function DashboardRoute() {
  const { cuid } = Route.useParams();
  const setCuid = useCuidStore((s) => s.setCuid);
  const { error } = useUser(cuid);

  useEffect(() => {
    setCuid(cuid);
    return () => setCuid(null);
  }, [cuid, setCuid]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-loss">User Not Found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No user exists with CUID: <code className="font-mono">{cuid}</code>
          </p>
          <a href="/" className="mt-4 inline-block text-sm text-primary hover:underline">
            Back to home
          </a>
        </div>
      </div>
    );
  }

  return <DashboardLayout cuid={cuid} />;
}
