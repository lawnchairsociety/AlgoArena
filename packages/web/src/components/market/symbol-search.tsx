import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAssets } from '@/api/hooks/use-assets';
import { Input } from '@/components/ui/input';

interface SymbolSearchProps {
  value: string;
  onChange: (symbol: string) => void;
}

export function SymbolSearch({ value, onChange }: SymbolSearchProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const { data: assets } = useAssets();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!assets || !query) return [];
    const q = query.toUpperCase();
    return assets
      .filter(
        (a) =>
          a.tradable &&
          (a.symbol.includes(q) || a.symbol.replace('/', '').includes(q) || a.name.toUpperCase().includes(q)),
      )
      .slice(0, 20);
  }, [assets, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-72">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search symbol..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value.toUpperCase());
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query) {
              onChange(query);
              setOpen(false);
            }
          }}
          className="pl-9"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.map((asset) => (
              <button
                type="button"
                key={asset.id}
                onClick={() => {
                  setQuery(asset.symbol);
                  onChange(asset.symbol);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <span className="font-medium">{asset.symbol}</span>
                <span className="ml-3 truncate text-xs text-muted-foreground">{asset.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
