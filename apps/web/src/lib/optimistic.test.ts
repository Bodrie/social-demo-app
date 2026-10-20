import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { holdQueries, resumeQueries, runningToggles } from './optimistic';

const never = () => new Promise<never>(() => {});
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

describe('holdQueries / resumeQueries', () => {
  it('resumes an observed query that the hold left pending without data', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = ['users', 'profile', 'bob'];
    let calls = 0;
    const queryFn = () => {
      calls += 1;
      return calls === 1 ? never() : Promise.resolve({ id: 'bob' });
    };
    const observer = new QueryObserver(queryClient, { queryKey, queryFn });
    const unsubscribe = observer.subscribe(() => {});
    await tick();
    expect(queryClient.getQueryState(queryKey)?.fetchStatus).toBe('fetching');

    const interrupted = await holdQueries(queryClient, [queryKey]);
    expect(interrupted).toEqual([queryKey]);
    expect(queryClient.getQueryState(queryKey)).toMatchObject({
      status: 'pending',
      fetchStatus: 'idle',
    });

    resumeQueries(queryClient, interrupted);
    await vi.waitFor(() => expect(queryClient.getQueryData(queryKey)).toEqual({ id: 'bob' }));
    expect(calls).toBe(2);
    unsubscribe();
  });

  it('resumes a refetch it interrupted, even after the optimistic write marked the data fresh', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = ['posts', 'list', 'feed'];
    let calls = 0;
    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn: () => {
        calls += 1;
        return calls === 2 ? never() : Promise.resolve({ calls });
      },
    });
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(queryClient.getQueryData(queryKey)).toEqual({ calls: 1 }));

    // Something invalidated the feed (a follow, say); a like holds it mid-refetch.
    void queryClient.invalidateQueries({ queryKey });
    await tick();
    const interrupted = await holdQueries(queryClient, [queryKey]);
    queryClient.setQueryData(queryKey, { calls: 1, liked: true });

    resumeQueries(queryClient, interrupted);
    await vi.waitFor(() => expect(queryClient.getQueryData(queryKey)).toEqual({ calls: 3 }));
    unsubscribe();
  });

  it('leaves idle queries alone', async () => {
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

    const interrupted = await holdQueries(queryClient, [queryKey, ['not', 'cached']]);
    expect(interrupted).toEqual([]);
    resumeQueries(queryClient, interrupted);
    await tick(20);
    expect(calls).toBe(1);
    unsubscribe();
  });
});

describe('runningToggles', () => {
  it('counts the running mutations of one item under a key', async () => {
    const queryClient = new QueryClient();
    const key = ['posts', 'like'];
    const release: (() => void)[] = [];
    const start = (postId: string) =>
      queryClient
        .getMutationCache()
        .build(queryClient, {
          mutationKey: key,
          mutationFn: () => new Promise<void>((resolve) => release.push(resolve)),
        })
        .execute({ postId });
    const done = Promise.all([start('a'), start('a'), start('b')]);
    await tick();

    expect(runningToggles(queryClient, key, { postId: 'a' })).toBe(2);
    expect(runningToggles(queryClient, key, { postId: 'b' })).toBe(1);
    expect(runningToggles(queryClient, key, { postId: 'c' })).toBe(0);
    expect(runningToggles(queryClient, ['users', 'follow'], { postId: 'a' })).toBe(0);

    for (const resolve of release) resolve();
    await done;
    expect(runningToggles(queryClient, key, { postId: 'a' })).toBe(0);
  });
});
