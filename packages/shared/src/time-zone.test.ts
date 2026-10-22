import { isTimeZone, localTime, timeZoneSchema } from './time-zone.js';

describe('time zones', () => {
  it('knows IANA names and refuses the rest', () => {
    expect(isTimeZone('Europe/Sofia')).toBe(true);
    expect(isTimeZone('America/New_York')).toBe(true);
    expect(isTimeZone('UTC')).toBe(true);
    expect(isTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isTimeZone('')).toBe(false);
    expect(timeZoneSchema.safeParse('Not/AZone').success).toBe(false);
  });

  it('reads the wall clock of a zone, across a daylight-saving change', () => {
    // Sofia moves from UTC+3 to UTC+2 at 04:00 local on the last Sunday of October.
    expect(localTime(new Date('2026-10-25T00:30:00Z'), 'Europe/Sofia')).toEqual({
      year: 2026,
      month: 10,
      day: 25,
      hour: 3,
      minute: 30,
      weekday: 7,
    });
    expect(localTime(new Date('2026-10-25T02:30:00Z'), 'Europe/Sofia').hour).toBe(4);
    // Midnight is hour 0, never 24.
    expect(localTime(new Date('2027-01-01T00:05:00Z'), 'UTC')).toMatchObject({
      month: 1,
      day: 1,
      hour: 0,
      weekday: 5,
    });
    // The same instant is another day elsewhere.
    expect(localTime(new Date('2028-02-29T23:30:00Z'), 'Asia/Tokyo')).toMatchObject({
      month: 3,
      day: 1,
    });
  });
});
