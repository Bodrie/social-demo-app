import { POST_MAX_LENGTH } from '@beso/shared';
import {
  clockMatches,
  hasHalloweenEmoji,
  hasKiss,
  isFullLength,
  isPalindrome,
  localHour,
} from './content-checks.js';

describe('content checks', () => {
  it('reads palindromes over letters and digits, at least seven letters', () => {
    // The badge's namesake: seven letters, exactly enough.
    expect(isPalindrome('Racecar!')).toBe(true);
    expect(isPalindrome('A man, a plan, a canal: Panama')).toBe(true);
    expect(isPalindrome('Never odd or even')).toBe(true);
    expect(isPalindrome('Кирил лирик')).toBe(true);
    // Accents do not count, however they are written.
    expect(isPalindrome('Ésope reste ici et se repose')).toBe(true);
    expect(isPalindrome('Ésope reste ici et se repose'.normalize('NFD'))).toBe(true);
    expect(isPalindrome('level')).toBe(false); // five letters
    expect(isPalindrome('Not a palindrome at all')).toBe(false);
  });

  it('counts the length the composer counts', () => {
    expect(isFullLength('x'.repeat(POST_MAX_LENGTH))).toBe(true);
    expect(isFullLength('x'.repeat(POST_MAX_LENGTH - 1))).toBe(false);
    // An emoji is two units, as in the composer's counter.
    expect(isFullLength(`${'x'.repeat(POST_MAX_LENGTH - 2)}😀`)).toBe(true);
  });

  it('finds the kiss and the Halloween emoji', () => {
    expect(hasKiss('night 😘')).toBe(true);
    expect(hasKiss('💋')).toBe(true);
    expect(hasKiss('😀')).toBe(false);
    expect(hasHalloweenEmoji('boo 👻')).toBe(true);
    expect(hasHalloweenEmoji('🎃')).toBe(true);
    expect(hasHalloweenEmoji('🍬')).toBe(false);
  });

  it('reads the clock in the member’s zone', () => {
    const sofia = 'Europe/Sofia';
    // 01:30 UTC is 04:30 in Sofia in summer time, 03:30 in winter time.
    expect(clockMatches('night-owl', new Date('2026-07-01T01:30:00Z'), sofia)).toBe(true);
    expect(clockMatches('night-owl', new Date('2026-07-01T02:30:00Z'), sofia)).toBe(false);
    expect(clockMatches('night-owl', new Date('2026-07-01T01:30:00Z'), 'UTC')).toBe(false);
    expect(clockMatches('early-bird', new Date('2026-12-01T04:15:00Z'), sofia)).toBe(true);
    expect(clockMatches('make-a-wish', new Date('2026-12-01T21:11:00Z'), sofia)).toBe(true);
    expect(clockMatches('make-a-wish', new Date('2026-12-01T21:12:00Z'), sofia)).toBe(false);
    expect(clockMatches('weekend-posts', new Date('2026-10-24T12:00:00Z'), sofia)).toBe(true);
    expect(clockMatches('weekend-posts', new Date('2026-10-23T12:00:00Z'), sofia)).toBe(false);
    // New Year in Sofia is 22:00 UTC the day before.
    expect(clockMatches('new-year', new Date('2026-12-31T22:30:00Z'), sofia)).toBe(true);
    expect(clockMatches('new-year', new Date('2026-12-31T22:30:00Z'), 'UTC')).toBe(false);
    expect(clockMatches('leap-day', new Date('2028-02-29T10:00:00Z'), sofia)).toBe(true);
    expect(clockMatches('leap-day', new Date('2028-02-29T23:00:00Z'), sofia)).toBe(false);
    expect(clockMatches('friday-13', new Date('2026-11-13T10:00:00Z'), sofia)).toBe(true);
    expect(clockMatches('friday-13', new Date('2026-12-13T10:00:00Z'), sofia)).toBe(false);
    expect(clockMatches('halloween', new Date('2026-10-31T20:00:00Z'), sofia)).toBe(true);
    expect(localHour(new Date('2026-10-25T00:30:00Z'), sofia)).toBe(3);
  });
});
