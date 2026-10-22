import {
  ACHIEVEMENTS,
  ACHIEVEMENT_BY_KEY,
  GETTING_STARTED_KEYS,
  achievementName,
  achievementSentence,
} from './achievements.js';

describe('achievements', () => {
  it('has one definition per key', () => {
    expect(ACHIEVEMENT_BY_KEY.size).toBe(ACHIEVEMENTS.length);
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.threshold, achievement.key).toBeGreaterThan(0);
    }
  });

  it('climbs every tiered series bronze upwards with growing thresholds', () => {
    const series = new Map<string, typeof ACHIEVEMENTS>();
    for (const achievement of ACHIEVEMENTS) {
      if (achievement.tier === null) continue;
      series.set(achievement.series, [...(series.get(achievement.series) ?? []), achievement]);
    }
    for (const [name, tiers] of series) {
      const thresholds = tiers.map((tier) => tier.threshold);
      expect(thresholds, name).toEqual(thresholds.toSorted((a, b) => a - b));
      expect(tiers[0]?.tier, name).toBe('bronze');
      expect(tiers[0]?.key, name).toBe(`${name}-${tiers[0]?.threshold}`);
    }
  });

  it('crowns the six getting-started badges with "All set"', () => {
    for (const key of GETTING_STARTED_KEYS) {
      expect(ACHIEVEMENT_BY_KEY.get(key)?.group).toBe('getting-started');
    }
    expect(ACHIEVEMENT_BY_KEY.get('all-set')?.threshold).toBe(GETTING_STARTED_KEYS.length);
  });

  it('keeps the hidden badges in their own group, Detective among them', () => {
    const hidden = ACHIEVEMENTS.filter((achievement) => achievement.hidden);
    expect(hidden).toHaveLength(22);
    expect(hidden.every((achievement) => achievement.group === 'hidden')).toBe(true);
    expect(ACHIEVEMENTS.filter((a) => a.group === 'hidden' && !a.hidden)).toEqual([]);
    expect(ACHIEVEMENT_BY_KEY.get('detective')?.series).toBe('hidden-found');
  });

  it('gives tiers their own titles where the catalogue says so', () => {
    const titles = ACHIEVEMENTS.filter((a) => a.series === 'top-post-likes').map((a) =>
      achievementName(a),
    );
    expect(titles).toEqual(['Hit (Bronze)', 'Smash hit (Silver)', 'Legend (Gold)']);
  });

  it('names a badge with its tier', () => {
    const gold = ACHIEVEMENT_BY_KEY.get('posts-100');
    const pioneer = ACHIEVEMENT_BY_KEY.get('pioneer');
    if (!gold || !pioneer) throw new Error('missing definitions');
    expect(achievementName(gold)).toBe('Storyteller (Gold)');
    expect(achievementName(pioneer)).toBe('Pioneer');
    expect(achievementSentence('first-post')).toBe('You earned “Hello, world”');
    expect(achievementSentence('no-such-badge')).toBe('You earned a badge');
  });
});
