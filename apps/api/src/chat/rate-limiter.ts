/** Fixed-window counter per key, in memory (single instance), for socket handlers. */
export class SocketRateLimiter {
  private readonly windows = new Map<string, { startedAt: number; count: number }>();
  private sweptAt = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    this.sweep(now);
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

  /** Keys nobody forgets (handshakes) would pile up; at most once a window, drop the expired ones. */
  private sweep(now: number): void {
    if (now - this.sweptAt < this.windowMs) return;
    this.sweptAt = now;
    for (const [key, window] of this.windows) {
      if (now - window.startedAt >= this.windowMs) this.windows.delete(key);
    }
  }
}
