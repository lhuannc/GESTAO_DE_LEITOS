import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../api/src/routers';

export const trpc = createTRPCReact<AppRouter>();

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: 'http://localhost:4000/trpc',
        // Include cookies in all requests
        // This allows JWT cookie to be sent automatically
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: 'include', // Send cookies cross-origin
          });
        },
      }),
    ],
  });
}
