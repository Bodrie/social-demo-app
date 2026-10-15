import { formatDateTime, formatRelativeTime } from './format';

const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('formatRelativeTime', () => {
  it('rounds to the most useful unit', () => {
    expect(formatRelativeTime(ago(10_000), NOW)).toBe('just now');
    expect(formatRelativeTime(ago(5 * 60_000), NOW)).toBe('5m');
    expect(formatRelativeTime(ago(3 * 3_600_000), NOW)).toBe('3h');
    expect(formatRelativeTime(ago(2 * 86_400_000), NOW)).toBe('2d');
  });

  it('falls back to a date after a week, with the year only when it differs', () => {
    expect(formatRelativeTime(ago(10 * 86_400_000), NOW)).toBe('Oct 5');
    expect(formatRelativeTime('2025-03-01T10:00:00.000Z', NOW)).toBe('Mar 1, 2025');
  });

  it('never goes negative for clock skew', () => {
    expect(formatRelativeTime(new Date(NOW + 60_000).toISOString(), NOW)).toBe('just now');
  });
});

describe('formatDateTime', () => {
  it('formats a full timestamp', () => {
    expect(formatDateTime('2026-10-15T09:05:00.000Z')).toMatch(/^Oct 15, 2026 at \d{2}:\d{2}$/);
  });
});
