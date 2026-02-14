import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';

export function InfoBox() {
  return (
    <Card className="relative overflow-visible">
      <div className="-mt-8 mb-2 flex justify-center">
        <img src="/algoarena.png" alt="AlgoArena" className="h-16 w-16 rounded-xl shadow-lg" />
      </div>
      <CardContent className="pt-0 text-center">
        <h1 className="text-2xl font-bold tracking-tight">AlgoArena</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Paper trading platform for testing algorithmic &amp; AI trading strategies.
          All trading via REST API &mdash; this dashboard is read-only.
        </p>
        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            GitHub <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Docs <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="/agent-guide"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Agent Guide
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
