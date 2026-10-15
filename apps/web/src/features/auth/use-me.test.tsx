import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { alice } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { createTestQueryClient } from '@/test/render';
import { useMe } from './use-me';

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}

describe('useMe', () => {
  it('reports anonymous when the API answers 401', async () => {
    const { result } = renderHook(() => useMe(), { wrapper });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(mockDb.calls.refresh).toBe(1);
  });

  it('reports the signed-in user', async () => {
    const user = signedInAs(alice);
    const { result } = renderHook(() => useMe(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user?.username).toBe(user.username);
  });
});
