import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/$cuid/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/dashboard/$cuid/portfolio', params });
  },
});
