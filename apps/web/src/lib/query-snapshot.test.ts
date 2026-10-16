import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { restoreQueries, resumePendingQueries, snapshotQueries } from './query-snapshot';

const never = () => new Promise<never>(() => {});

describe('snapshotQueries / restoreQueries', () => {
  it('captures and puts back the data of every matching query', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['users', 'profile', 'bob'], { id: 'bob', followedByMe: false });
    queryClient.setQueryData(['posts', 'list', 'feed'], { pages: [] });
    const snapshot = snapshotQueries(queryClient, { queryKey: ['users'] });
    expect(snapshot).toHaveLength(1);

    queryClient.setQueryData(['users', 'profile', 'bob'], { id: 'bob', followedByMe: true });
    restoreQueries(queryClient, snapshot);
    expect(queryClient.getQueryData(['users', 'profile', 'bob'])).toEqual({
      id: 'bob',
      followedByMe: false,
    });
  });
});

describe('resumePendingQueries', () => {
  it('refetches an observed query that cancelQueries left pending without data', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = ['users', 'profile', 'bob'];
    let calls = 0;
    const queryFn = () => {
      calls += 1;
      return calls === 1 ? never() : Promise.resolve({ id: 'bob' });
    };
    const observer = new QueryObserver(queryClient, { queryKey, queryFn });
    const unsubscribe = observer.subscribe(() => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(queryClient.getQueryState(queryKey)?.fetchStatus).toBe('fetching');

    // What every optimistic mutation does first: the first fetch is reverted, nothing arrives.
    await queryClient.cancelQueries({ queryKey: ['users'] });
    expect(queryClient.getQueryState(queryKey)).toMatchObject({
      status: 'pending',
      fetchStatus: 'idle',
      data: undefined,
    });

    resumePendingQueries(queryClient, { queryKey: ['users'] });
    await vi.waitFor(() => expect(queryClient.getQueryData(queryKey)).toEqual({ id: 'bob' }));
    expect(calls).toBe(2);
    unsubscribe();
  });

  it('leaves queries that already have data alone', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = ['users', 'profile', 'bob'];
    let calls = 0;
    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn: () => {
        calls += 1;
        return Promise.resolve({ id: 'bob', calls });
      },
    });
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(queryClient.getQueryData(queryKey)).toBeDefined());

    resumePendingQueries(queryClient, { queryKey: ['users'] });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toBe(1);
    unsubscribe();
  });
});
