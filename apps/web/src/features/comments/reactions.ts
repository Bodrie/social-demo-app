import type { ReactionSummary, ReactionType } from '@beso/shared';

export function emptyReactions(): ReactionSummary {
  return { counts: { LIKE: 0, LOVE: 0, LAUGH: 0, WOW: 0, SAD: 0 }, total: 0, mine: null };
}

/** The summary after the viewer reacts with `type` (or removes their reaction with null). */
export function withMyReaction(
  summary: ReactionSummary,
  type: ReactionType | null,
): ReactionSummary {
  if (summary.mine === type) return summary;
  const counts = { ...summary.counts };
  let total = summary.total;
  if (summary.mine) {
    counts[summary.mine] = Math.max(0, counts[summary.mine] - 1);
    total -= 1;
  }
  if (type) {
    counts[type] += 1;
    total += 1;
  }
  return { counts, total: Math.max(0, total), mine: type };
}
