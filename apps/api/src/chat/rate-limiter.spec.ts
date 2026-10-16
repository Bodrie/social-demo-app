import { SocketRateLimiter } from './rate-limiter.js';

describe('SocketRateLimiter', () => {
  it('allows `limit` calls per window per key and resets after the window', () => {
    const limiter = new SocketRateLimiter(2, 1000);
    expect(limiter.allow('a', 0)).toBe(true);
    expect(limiter.allow('a', 10)).toBe(true);
    expect(limiter.allow('a', 20)).toBe(false);
    expect(limiter.allow('b', 20)).toBe(true);
    expect(limiter.allow('a', 1000)).toBe(true);
  });

  it('forgets a key', () => {
    const limiter = new SocketRateLimiter(1, 1000);
    expect(limiter.allow('a', 0)).toBe(true);
    limiter.forget('a');
    expect(limiter.allow('a', 1)).toBe(true);
  });

  it('drops expired windows of keys nobody forgets, without resetting live ones', () => {
    const limiter = new SocketRateLimiter(1, 1000);
    const windows = (limiter as unknown as { windows: Map<string, unknown> }).windows;
    expect(limiter.allow('gone', 1000)).toBe(true);
    expect(limiter.allow('live', 1600)).toBe(true);
    expect(windows.size).toBe(2);

    // One window later 'gone' has expired and is swept; 'live' is still counting.
    expect(limiter.allow('other', 2100)).toBe(true);
    expect([...windows.keys()].toSorted()).toEqual(['live', 'other']);
    expect(limiter.allow('live', 2200)).toBe(false);
  });
});
