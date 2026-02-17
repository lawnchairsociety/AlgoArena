import { AnalyticsPeriod } from '@algoarena/shared';

export function periodToDateRange(period: AnalyticsPeriod): { startDate: string; endDate: string } {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0];

  let start: Date;

  switch (period) {
    case '7d':
      start = new Date(today);
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start = new Date(today);
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start = new Date(today);
      start.setDate(start.getDate() - 90);
      break;
    case 'ytd':
      start = new Date(today.getFullYear(), 0, 1);
      break;
    case '1y':
      start = new Date(today);
      start.setDate(start.getDate() - 365);
      break;
    case 'all':
      return { startDate: '2000-01-01', endDate };
  }

  return { startDate: start.toISOString().split('T')[0], endDate };
}
