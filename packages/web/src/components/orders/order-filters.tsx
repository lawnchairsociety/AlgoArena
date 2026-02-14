import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ORDER_STATUSES = ['pending', 'filled', 'partially_filled', 'cancelled', 'expired', 'rejected'] as const;

interface OrderFiltersProps {
  status: string;
  symbol: string;
  onStatusChange: (status: string) => void;
  onSymbolChange: (symbol: string) => void;
}

export function OrderFilters({ status, symbol, onStatusChange, onSymbolChange }: OrderFiltersProps) {
  return (
    <div className="flex gap-3">
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {ORDER_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s.replace('_', ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="Filter by symbol..."
        value={symbol}
        onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
        className="w-40"
      />
    </div>
  );
}
