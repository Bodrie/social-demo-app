import { QueryClient } from '@tanstack/react-query';
import { isApiClientError } from '@/lib/api/client';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        // A rejected request is rarely fixed by repeating it; 4xx never is.
        retry: (failureCount, error) =>
          !(isApiClientError(error) && error.status < 500) && failureCount < 2,
        refetchOnWindowFocus: false,
      },
    },
  });
}
