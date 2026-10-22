import {
  type AchievementDefinition,
  type AchievementGroup,
  ACHIEVEMENTS,
  type AchievementStats,
  type EarnedAchievement,
} from '@beso/shared/achievements';

/**
 * One tile of the Badges tab: a badge, or a tiered series folded into one (the highest tier
 * earned on the medallion, the next one as the goal).
 */
export type BadgeTile = {
  id: string;
  title: string;
  /** The highest earned badge of the tile, or null while none is. */
  earned: AchievementDefinition | null;
  earnedAt: string | null;
  /** The badge still to earn: the next tier, or the badge itself while locked. */
  next: AchievementDefinition | null;
};

const TIER_RANK = { bronze: 1, silver: 2, gold: 3, platinum: 4 } as const;
const rank = (definition: AchievementDefinition): number =>
  definition.tier === null ? 0 : TIER_RANK[definition.tier];

export function tilesOf(group: AchievementGroup, earned: ReadonlyMap<string, string>): BadgeTile[] {
  const definitions = ACHIEVEMENTS.filter((achievement) => achievement.group === group);
  const tiles: BadgeTile[] = [];
  const folded = new Set<string>();
  for (const definition of definitions) {
    if (definition.tier === null) {
      const earnedAt = earned.get(definition.key) ?? null;
      tiles.push({
        id: definition.key,
        title: definition.title,
        earned: earnedAt === null ? null : definition,
        earnedAt,
        next: earnedAt === null ? definition : null,
      });
      continue;
    }
    if (folded.has(definition.series)) continue;
    folded.add(definition.series);
    const tiers = definitions.filter(
      (candidate) => candidate.series === definition.series && candidate.tier !== null,
    );
    const top = tiers.findLast((tier) => earned.has(tier.key)) ?? null;
    tiles.push({
      id: definition.series,
      title: definition.title,
      earned: top,
      earnedAt: top ? (earned.get(top.key) ?? null) : null,
      next: tiers.find((tier) => !earned.has(tier.key)) ?? null,
    });
  }
  return tiles;
}

export const earnedMap = (items: readonly EarnedAchievement[]): Map<string, string> =>
  new Map(items.map((item) => [item.key, item.earnedAt]));

/** Share of members holding a badge, as "12 %", or null while the stats are not there. */
export function rarityOf(key: string, stats: AchievementStats | undefined): string | null {
  if (!stats || stats.members === 0) return null;
  const holders = stats.items.find((item) => item.key === key)?.holders ?? 0;
  const share = (holders / stats.members) * 100;
  return share < 1 && holders > 0 ? '< 1 %' : `${Math.round(share)} %`;
}

/**
 * The badges a profile shows first: the rarest (fewest holders), then the higher tier, then
 * the most recent. Without stats, tier and recency decide.
 */
export function rarest(
  items: readonly EarnedAchievement[],
  stats: AchievementStats | undefined,
  count: number,
  byKey: ReadonlyMap<string, AchievementDefinition>,
): AchievementDefinition[] {
  const holders = new Map(stats?.items.map((item) => [item.key, item.holders]));
  return items
    .flatMap((item) => {
      const definition = byKey.get(item.key);
      return definition ? [{ definition, earnedAt: item.earnedAt }] : [];
    })
    .toSorted(
      (a, b) =>
        (holders.get(a.definition.key) ?? Number.MAX_SAFE_INTEGER) -
          (holders.get(b.definition.key) ?? Number.MAX_SAFE_INTEGER) ||
        rank(b.definition) - rank(a.definition) ||
        b.earnedAt.localeCompare(a.earnedAt),
    )
    .slice(0, count)
    .map((entry) => entry.definition);
}
