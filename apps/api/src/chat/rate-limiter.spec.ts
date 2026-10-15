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
});
