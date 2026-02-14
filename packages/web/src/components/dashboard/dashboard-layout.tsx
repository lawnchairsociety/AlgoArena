import { Outlet } from '@tanstack/react-router';
import { DashboardHeader } from './dashboard-header';
import { DashboardNav } from './dashboard-nav';

export function DashboardLayout({ cuid }: { cuid: string }) {
  return (
    <div className="flex h-screen flex-col">
      <DashboardHeader />
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:block w-52 shrink-0 border-r">
          <DashboardNav cuid={cuid} variant="sidebar" />
        </aside>
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background z-50">
        <DashboardNav cuid={cuid} variant="bottom" />
      </nav>
    </div>
  );
}
