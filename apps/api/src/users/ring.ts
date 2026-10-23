import { type ProfileRing, profileRingSchema, userSettingsSchema } from '@beso/shared';
import type { PrismaService } from '../prisma/prisma.service.js';

/** Collector's tiers, best last: the ring a member's avatar wears (ADR 0021, "Rewards"). */
const RING_OF: ReadonlyArray<[key: string, ring: ProfileRing]> = [
  ['collected-10', 'bronze'],
  ['collected-25', 'silver'],
  ['collected-50', 'gold'],
  ['collected-75', 'platinum'],
];
export const RING_KEYS: ReadonlySet<string> = new Set(RING_OF.map(([key]) => key));

/** The best Collector tier among `held`, or none. */
export function ringOf(held: Iterable<string>): ProfileRing | null {
  const keys = new Set(held);
  return RING_OF.findLast(([key]) => keys.has(key))?.[1] ?? null;
}

/** A stored ring that no longer parses shows as none rather than failing a whole list. */
export function toRing(stored: string | null): ProfileRing | null {
  const parsed = profileRingSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

/**
 * Writes the ring the member's avatar shows: their Collector tier while both their badges and
 * the ring are switched on in their settings. Called when a Collector badge is awarded and when
 * either setting changes; every list reads the stored value.
 */
export async function refreshRing(prisma: PrismaService, userId: string): Promise<void> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      settings: true,
      achievements: { where: { key: { in: [...RING_KEYS] } }, select: { key: true } },
    },
  });
  if (!row) return;
  // Unreadable settings count as the defaults, as everywhere (`toUserSettings`).
  const parsed = userSettingsSchema.safeParse(row.settings ?? {});
  const settings = parsed.success ? parsed.data : userSettingsSchema.parse({});
  const ring =
    settings.showAchievements && settings.showRing
      ? ringOf(row.achievements.map((achievement) => achievement.key))
      : null;
  await prisma.user.update({ where: { id: userId }, data: { ring } });
}
