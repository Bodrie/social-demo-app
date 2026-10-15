import dayjs from 'dayjs';

/**
 * Compact relative time for timelines: "just now", "5m", "3h", "2d", then a date.
 * `now` is injectable for tests.
 */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const date = dayjs(then);
  return date.year() === dayjs(now).year() ? date.format('MMM D') : date.format('MMM D, YYYY');
}

/** Full date and time, for tooltips on relative timestamps. */
export function formatDateTime(iso: string): string {
  return dayjs(iso).format('MMM D, YYYY [at] HH:mm');
}
