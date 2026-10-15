import { QueryClient } from '@tanstack/react-query';
import { type RenderResult, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { Providers } from '@/app/providers';
import { createTestRouter } from '@/app/router';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
}

/** The whole application at `route`, with the real route tree and a fresh cache. */
export function renderApp(route = '/'): RenderResult & { queryClient: QueryClient } {
  const queryClient = createTestQueryClient();
  const router = createTestRouter([route]);
  const result = render(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...result, queryClient };
}

/** A single component inside providers and a throwaway router (for Link/NavLink/useNavigate). */
export function renderWithProviders(
  ui: ReactNode,
  route = '/',
): RenderResult & { queryClient: QueryClient } {
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries: [route] });
  const result = render(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...result, queryClient };
}
