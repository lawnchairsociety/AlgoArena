import { createFileRoute } from '@tanstack/react-router';
import { AccountSummaryCards } from '@/components/portfolio/account-summary-cards';
import { PdtStatusBadge } from '@/components/portfolio/pdt-status-badge';
import { PnlChart } from '@/components/portfolio/pnl-chart';
import { PositionsTable } from '@/components/portfolio/positions-table';

export const Route = createFileRoute('/dashboard/$cuid/portfolio')({
  component: PortfolioPage,
});

function PortfolioPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Portfolio</h2>
        <PdtStatusBadge />
      </div>
      <AccountSummaryCards />
      <PnlChart />
      <PositionsTable />
    </div>
  );
}
