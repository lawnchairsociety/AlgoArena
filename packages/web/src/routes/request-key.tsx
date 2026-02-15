import { createFileRoute, Link } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { apiClient } from '@/api/client';
import { FloatingCandles } from '@/components/landing/floating-candles';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/request-key')({
  component: RequestKeyPage,
});

function RequestKeyPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const canSubmit = name.trim().length > 0 && isValidEmail(email) && status !== 'loading';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      await apiClient.post('/auth/request-key', { name: name.trim(), email: email.trim() });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      if (isAxiosError(err) && err.response?.status === 429) {
        setErrorMessage('Too many requests. Please try again in 15 minutes.');
      } else if (isAxiosError(err) && err.response?.status === 503) {
        setErrorMessage('This service is temporarily unavailable. Please try again later.');
      } else {
        setErrorMessage('Something went wrong. Please try again.');
      }
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <FloatingCandles />
      <div className="w-full max-w-md">
        <Card className="relative overflow-visible">
          <div className="-mt-10 mb-2 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary shadow-lg">
              <KeyRound className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <CardContent className="pt-0 text-center">
            <h1 className="text-2xl font-bold tracking-tight">Request API Key</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Submit your details and we'll provision an API key for you.
            </p>

            {status === 'success' ? (
              <div className="mt-6 space-y-4">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
                <p className="text-sm text-muted-foreground">
                  Your request has been submitted. You'll receive an email when your API key is ready.
                </p>
                <Link to="/" className="inline-block text-sm text-primary hover:underline">
                  Back to home
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Name
                  </label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    disabled={status === 'loading'}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                    disabled={status === 'loading'}
                  />
                </div>

                {status === 'error' && <p className="text-sm text-destructive">{errorMessage}</p>}

                <p className="text-xs text-muted-foreground text-center">
                  Your information is used solely for API key management and will not be shared with anyone. Your API
                  key will be emailed to the address provided.
                </p>

                <Button type="submit" className="w-full" disabled={!canSubmit}>
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </Button>

                <div className="text-center">
                  <Link to="/" className="text-sm text-muted-foreground hover:underline">
                    Back to home
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
