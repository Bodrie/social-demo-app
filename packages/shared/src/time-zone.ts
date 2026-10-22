import { z } from 'zod';

/**
 * Time zones (F2b): a member's `settings.timeZone` is an IANA name such as `Europe/Sofia`, set by
 * the web from the device and changeable in Settings. Local times are worked out with `Intl` on
 * both sides, never in SQL, so the API and the browser agree.
 */

const known = new Set<string>();

/** Whether `Intl` knows the zone (IANA names and their aliases). */
export function isTimeZone(name: string): boolean {
  if (known.has(name)) return true;
  if (name.length === 0 || name.length > 64) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: name }).resolvedOptions();
  } catch {
    return false;
  }
  known.add(name);
  return true;
}

export const timeZoneSchema = z.string().refine(isTimeZone, 'Not a time zone');

/** The wall clock in a zone: `weekday` 1 is Monday, 7 Sunday (ISO). */
export type LocalTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const formatters = new Map<string, Intl.DateTimeFormat>();

export function localTime(date: Date, timeZone: string): LocalTime {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
    });
    formatters.set(timeZone, format);
  }
  const parts = new Map(format.formatToParts(date).map((part) => [part.type, part.value]));
  const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.get(type));
  return {
    year: number('year'),
    month: number('month'),
    day: number('day'),
    hour: number('hour'),
    minute: number('minute'),
    weekday: WEEKDAYS.indexOf(parts.get('weekday') ?? '') + 1,
  };
}
