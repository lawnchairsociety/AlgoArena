export function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatQuantity(value: string): string {
  const num = parseFloat(value);
  // Trim trailing zeros, up to 6 decimal places
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

export function formatPercent(current: string | number, basis: string | number): string {
  const c = typeof current === 'string' ? parseFloat(current) : current;
  const b = typeof basis === 'string' ? parseFloat(basis) : basis;
  if (b === 0) return '0.00%';
  const pct = ((c - b) / Math.abs(b)) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

export function pnlColor(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num > 0) return 'text-profit';
  if (num < 0) return 'text-loss';
  return 'text-muted-foreground';
}
