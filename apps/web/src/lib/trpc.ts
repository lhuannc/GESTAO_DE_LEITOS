import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../api/src/routers';

export const trpc = createTRPCReact<AppRouter>();

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: 'http://localhost:4000/trpc',
        headers() {
          const userId = localStorage.getItem('userId');
          return userId ? { 'x-user-id': userId } : {};
        },
      }),
    ],
  });
}
