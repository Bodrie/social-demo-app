import { RELOAD_GUARD_MS, isStaleChunkError, reloadForNewVersion } from './new-version';

describe('isStaleChunkError', () => {
  it('recognises the messages browsers use for a missing chunk', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://x/assets/routes-AbC123.js',
      'error loading dynamically imported module: https://x/assets/routes-AbC123.js',
      'Importing a module script failed.',
      'Unable to preload CSS for /assets/routes-AbC123.css',
    ]) {
      expect(isStaleChunkError(new TypeError(message))).toBe(true);
    }
    expect(isStaleChunkError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isStaleChunkError('Failed to fetch dynamically imported module')).toBe(false);
  });
});

describe('reloadForNewVersion', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reloads once, then not again within the guard window', () => {
    const reload = vi.fn();
    expect(reloadForNewVersion(reload)).toBe(true);
    expect(reloadForNewVersion(reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(RELOAD_GUARD_MS);
    expect(reloadForNewVersion(reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
