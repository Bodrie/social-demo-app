/** Fixed-window counter per key, in memory (single instance), for socket handlers. */
export class SocketRateLimiter {
  private readonly windows = new Map<string, { startedAt: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const window = this.windows.get(key);
    if (!window || now - window.startedAt >= this.windowMs) {
      this.windows.set(key, { startedAt: now, count: 1 });
      return true;
    }
    window.count += 1;
    return window.count <= this.limit;
  }

  forget(key: string): void {
    this.windows.delete(key);
  }
}
