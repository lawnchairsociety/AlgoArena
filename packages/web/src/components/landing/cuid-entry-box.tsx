import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

export function CuidEntryBox() {
  const [cuid, setCuid] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = cuid.trim();
    if (trimmed) {
      navigate({ to: '/dashboard/$cuid/portfolio', params: { cuid: trimmed } });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Enter your CUID</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="e.g. cm1a2b3c4..."
            value={cuid}
            onChange={(e) => setCuid(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={!cuid.trim()}>
            <LogIn className="mr-1 h-4 w-4" />
            Go
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
