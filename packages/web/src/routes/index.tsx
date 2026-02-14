import { createFileRoute } from '@tanstack/react-router';
import { FloatingCandles } from '@/components/landing/floating-candles';
import { InfoBox } from '@/components/landing/info-box';
import { CuidEntryBox } from '@/components/landing/cuid-entry-box';
import { ActivityChartBox } from '@/components/landing/activity-chart-box';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <FloatingCandles />
      <div className="flex w-full max-w-md flex-col gap-6 pt-8">
        <InfoBox />
        <CuidEntryBox />
        <ActivityChartBox />
      </div>
    </div>
  );
}
