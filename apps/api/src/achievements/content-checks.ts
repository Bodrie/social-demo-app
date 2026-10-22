import { POST_MAX_LENGTH, localTime } from '@beso/shared';

/**
 * The checks of single texts and timestamps behind the hidden badges (F2b, ADR 0021). Pure, so
 * the counter can run them over a member's posts and the unit tests over awkward input.
 */

const KEYCAP = /[0-9#*]\uFE0F?\u20E3/u;
const KEYCAPS = new RegExp(KEYCAP.source, 'gu');
/** What an emoji is built from: pictographs, skin tones, joiners, variation selectors, flags, tags. */
const EMOJI_PART =
  /\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u200D|\uFE0F|[\u{E0020}-\u{E007F}]/gu;
const PICTOGRAPH = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** "Speechless": nothing but emoji (and spaces between them). */
export function isEmojiOnly(text: string): boolean {
  const compact = text.replace(/\s+/gu, '');
  if (!PICTOGRAPH.test(compact) && !KEYCAP.test(compact)) return false;
  return compact.replace(KEYCAPS, '').replace(EMOJI_PART, '') === '';
}

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const LETTER = /\p{L}/u;

const MARKS = /\p{M}/gu;

/**
 * "Racecar": the letters and digits read the same both ways, at least seven letters; case,
 * spaces, punctuation and accents do not count (as in "Ésope reste ici et se repose").
 */
export function isPalindrome(text: string): boolean {
  const folded = text.normalize('NFD').replace(MARKS, '').toLocaleLowerCase('en');
  const characters = Array.from(folded).filter((ch) => LETTER_OR_DIGIT.test(ch));
  if (characters.filter((ch) => LETTER.test(ch)).length < 7) return false;
  return characters.join('') === characters.toReversed().join('');
}

/** "To the letter": the length the composer counts (UTF-16 units), at the limit. */
export const isFullLength = (text: string): boolean => text.length === POST_MAX_LENGTH;

export const hasKiss = (text: string): boolean => text.includes('😘') || text.includes('💋');

export const hasHalloweenEmoji = (text: string): boolean =>
  text.includes('🎃') || text.includes('👻');

/** The clock checks, in the member's time zone. */
export type ClockCheck =
  | 'night-owl'
  | 'early-bird'
  | 'make-a-wish'
  | 'weekend-posts'
  | 'new-year'
  | 'leap-day'
  | 'friday-13'
  | 'halloween';

export function clockMatches(check: ClockCheck, at: Date, timeZone: string): boolean {
  const t = localTime(at, timeZone);
  switch (check) {
    case 'night-owl':
      return t.hour >= 2 && t.hour <= 4;
    case 'early-bird':
      return t.hour >= 5 && t.hour <= 6;
    case 'make-a-wish':
      return t.minute === 11 && (t.hour === 11 || t.hour === 23);
    case 'weekend-posts':
      return t.weekday >= 6;
    case 'new-year':
      return t.month === 1 && t.day === 1 && t.hour === 0;
    case 'leap-day':
      return t.month === 2 && t.day === 29;
    case 'friday-13':
      return t.weekday === 5 && t.day === 13;
    case 'halloween':
      return t.month === 10 && t.day === 31;
    default: {
      const unknown: never = check;
      throw new Error(`No clock check ${String(unknown)}`);
    }
  }
}

/** The hour of the day in the zone, for "Around the clock". */
export const localHour = (at: Date, timeZone: string): number => localTime(at, timeZone).hour;
