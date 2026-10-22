import { z } from 'zod';

/**
 * Achievements (F2, ADR 0021): badges for what members do and for what others do with it.
 * Every badge is earned once and kept. The API counts a series for a member and awards each
 * badge of that series whose threshold the count reached; the web shows them with the same
 * definitions. A new badge is one entry in `ACHIEVEMENTS` (and, for a new series, one counter
 * in the API).
 *
 * Published as the entry `@beso/shared/achievements`, not from the package's main entry: the
 * web imports it only from the screens that show badges, so none of it is on the first paint.
 */

export const ACHIEVEMENT_GROUPS = [
  'getting-started',
  'firsts',
  'milestones',
  'recognition',
  'community',
  'tenure',
  'hidden',
] as const;
export type AchievementGroup = (typeof ACHIEVEMENT_GROUPS)[number];

export const ACHIEVEMENT_TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const;
export type AchievementTier = (typeof ACHIEVEMENT_TIERS)[number];

/** What the API counts for a member; a badge names the series and the count it needs. */
export const ACHIEVEMENT_SERIES = [
  'avatar',
  'cover',
  'bio',
  'full-profile',
  'following',
  'posts',
  'comments',
  'replies',
  'picture-posts',
  'pictures',
  'hashtag-posts',
  'tags',
  'mentions-given',
  'reposts',
  'quotes',
  'amplified',
  'messages',
  'groups-created',
  'likes-given',
  'reactions-given',
  'bookmarks',
  'push-devices',
  'membership-days',
  'pioneer',
  'founding',
  'first-100',
  // Recognition: what others do with what the member shares.
  'followers',
  'likes-received',
  /** The most liked post, the most commented one (by others), and so on: one item's count. */
  'top-post-likes',
  'top-post-comments',
  'top-comment-reactions',
  'top-post-reposts',
  /** Different members who mentioned the member. */
  'mentioned-by',
  /** Tags the member used first that five other members then used. */
  'trendsetter',
  // Community.
  /** Members followed or commented on in their first week. */
  'newcomers-welcomed',
  /** Others' posts on which the member wrote the first comment. */
  'first-responses',
  'mutual-follows',
  /** The largest group the member created, and the largest one they are in. */
  'crew',
  'big-table',
  /** Members who joined through the member's invite and confirmed their address. */
  'recruits',
  // Hidden. The time ones read the clock in the member's time zone and count nothing without one.
  'night-owl',
  'early-bird',
  'make-a-wish',
  /** Distinct hours of the day with a post, a comment or a message. */
  'around-the-clock',
  'weekend-posts',
  'new-year',
  'leap-day',
  'friday-13',
  'trick-or-treat',
  'un-beso',
  'home-team',
  'emoji-only',
  'palindrome',
  'full-length',
  'quick-draw',
  'archaeologist',
  'welcome-back',
  /** The most edits of one post. */
  'perfectionist',
  'inception',
  /** Different reaction types the member has on comments. */
  'full-range',
  'self-reply',
  /**
   * Derived from the badges themselves: the six Getting started ones, all of them, and the
   * hidden ones.
   */
  'getting-started',
  'collected',
  'hidden-found',
] as const;
export type AchievementSeries = (typeof ACHIEVEMENT_SERIES)[number];

/** lucide icon names; the web maps each to its component. */
export type AchievementIcon =
  | 'camera'
  | 'image'
  | 'notebook-pen'
  | 'users'
  | 'pen-line'
  | 'message-square'
  | 'badge-check'
  | 'images'
  | 'hash'
  | 'at-sign'
  | 'repeat-2'
  | 'quote'
  | 'message-circle'
  | 'users-round'
  | 'heart'
  | 'smile-plus'
  | 'bookmark'
  | 'id-card'
  | 'smartphone'
  | 'scroll-text'
  | 'messages-square'
  | 'reply'
  | 'hand-heart'
  | 'smile'
  | 'aperture'
  | 'message-circle-more'
  | 'compass'
  | 'megaphone'
  | 'network'
  | 'trophy'
  | 'calendar-heart'
  | 'flag'
  | 'landmark'
  | 'medal'
  | 'user-round-plus'
  | 'heart-pulse'
  | 'flame'
  | 'speech'
  | 'star'
  | 'share-2'
  | 'radio'
  | 'trending-up'
  | 'handshake'
  | 'zap'
  | 'orbit'
  | 'sailboat'
  | 'utensils-crossed'
  | 'mail-plus'
  | 'moon-star'
  | 'sunrise'
  | 'sparkles'
  | 'clock'
  | 'sofa'
  | 'party-popper'
  | 'rabbit'
  | 'cat'
  | 'ghost'
  | 'message-circle-heart'
  | 'house'
  | 'laugh'
  | 'ruler'
  | 'car'
  | 'timer'
  | 'shovel'
  | 'door-open'
  | 'eraser'
  | 'layers'
  | 'palette'
  | 'message-circle-dashed'
  | 'fingerprint';

export type AchievementDefinition = {
  key: string;
  group: AchievementGroup;
  series: AchievementSeries;
  /** The count of the series that earns it (1 for a first, 6 for "all six", days for tenure). */
  threshold: number;
  tier: AchievementTier | null;
  title: string;
  /** What earns it, as the member reads it. */
  description: string;
  icon: AchievementIcon;
  /** Shown only once earned (F2b's hidden group). */
  hidden: boolean;
};

/** The day BeSo opens to visitors: accounts before it are the testers ("Pioneer"). */
export const BESO_OPENING = '2026-10-29T00:00:00.000Z';
/** Members who join this many days after the opening are "Founding members". */
export const FOUNDING_PERIOD_DAYS = 30;

export const ACHIEVEMENT_GROUP_TITLES: Record<AchievementGroup, string> = {
  'getting-started': 'Getting started',
  firsts: 'Firsts',
  milestones: 'Milestones',
  recognition: 'Recognition',
  community: 'Community',
  tenure: 'Tenure',
  hidden: 'Hidden',
};

const one = (
  key: string,
  group: AchievementGroup,
  series: AchievementSeries,
  title: string,
  description: string,
  icon: AchievementIcon,
  threshold = 1,
): AchievementDefinition => ({
  key,
  group,
  series,
  threshold,
  tier: null,
  title,
  description,
  icon,
  hidden: false,
});

/** A series in tiers: one key per threshold, bronze upwards. */
const tiered = (
  series: AchievementSeries,
  /** One title for every tier, or one per tier ("Hit", "Smash hit", "Legend"). */
  title: string | readonly string[],
  icon: AchievementIcon,
  describe: (count: string) => string,
  thresholds: readonly number[],
  group: AchievementGroup = 'milestones',
): AchievementDefinition[] =>
  thresholds.map((threshold, index) => ({
    key: `${series}-${threshold}`,
    group,
    series,
    threshold,
    tier: ACHIEVEMENT_TIERS[index] ?? 'platinum',
    title: typeof title === 'string' ? title : (title[index] ?? title.at(-1) ?? ''),
    description: describe(threshold.toLocaleString('en')),
    icon,
    hidden: false,
  }));

const tenure = (key: string, title: string, days: number, description: string) =>
  one(key, 'tenure', 'membership-days', title, description, 'calendar-heart', days);

/** A hidden badge: shown once earned; until then the member sees only how many they found. */
const secret = (
  key: string,
  series: AchievementSeries,
  title: string,
  description: string,
  icon: AchievementIcon,
  threshold = 1,
): AchievementDefinition => ({
  ...one(key, 'hidden', series, title, description, icon, threshold),
  hidden: true,
});

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  // Getting started: the newcomer's checklist (the card on the home feed).
  one(
    'profile-picture',
    'getting-started',
    'avatar',
    'Say cheese',
    'Add a profile picture.',
    'camera',
  ),
  one('cover-photo', 'getting-started', 'cover', 'Widescreen', 'Add a cover photo.', 'image'),
  one(
    'bio',
    'getting-started',
    'bio',
    'About me',
    'Write a few words about yourself.',
    'notebook-pen',
  ),
  one(
    'follow-3',
    'getting-started',
    'following',
    'Good company',
    'Follow three members.',
    'users',
    3,
  ),
  one(
    'first-post',
    'getting-started',
    'posts',
    'Hello, world',
    'Write your first post.',
    'pen-line',
  ),
  one(
    'first-comment',
    'getting-started',
    'comments',
    'Joining in',
    'Write your first comment.',
    'message-square',
  ),
  one(
    'all-set',
    'getting-started',
    'getting-started',
    'All set',
    'Do all six of the above.',
    'badge-check',
    6,
  ),

  // Firsts
  one(
    'first-picture-post',
    'firsts',
    'picture-posts',
    'Worth a thousand words',
    'Post a picture.',
    'images',
  ),
  one('first-hashtag', 'firsts', 'hashtag-posts', 'Tagged', 'Use a #hashtag in a post.', 'hash'),
  one(
    'first-mention',
    'firsts',
    'mentions-given',
    'Shout-out',
    'Mention a member with @.',
    'at-sign',
  ),
  one('first-repost', 'firsts', 'reposts', 'Pass it on', 'Repost a post.', 'repeat-2'),
  one('first-quote', 'firsts', 'quotes', 'In my own words', 'Quote a post.', 'quote'),
  one(
    'first-message',
    'firsts',
    'messages',
    'Say hi',
    'Send your first chat message.',
    'message-circle',
  ),
  one('first-group', 'firsts', 'groups-created', 'Host', 'Start a group chat.', 'users-round'),
  one('first-like', 'firsts', 'likes-given', 'Big heart', 'Like a post.', 'heart'),
  one(
    'first-reaction',
    'firsts',
    'reactions-given',
    'Feelings',
    'React to a comment or a message.',
    'smile-plus',
  ),
  one('first-bookmark', 'firsts', 'bookmarks', 'Saved for later', 'Bookmark a post.', 'bookmark'),
  one(
    'full-profile',
    'firsts',
    'full-profile',
    'The full picture',
    'Fill in picture, cover, bio, city and website.',
    'id-card',
  ),
  one(
    'push-device',
    'firsts',
    'push-devices',
    'Pocket-sized',
    'Switch on push notifications on a device.',
    'smartphone',
  ),

  // Milestones
  ...tiered('posts', 'Storyteller', 'scroll-text', (n) => `Write ${n} posts.`, [10, 50, 100, 250]),
  ...tiered(
    'comments',
    'Commentator',
    'messages-square',
    (n) => `Write ${n} comments.`,
    [10, 50, 100, 250],
  ),
  ...tiered(
    'replies',
    'In the thread',
    'reply',
    (n) => `Reply to comments ${n} times.`,
    [10, 50, 100],
  ),
  ...tiered(
    'likes-given',
    'Generous',
    'hand-heart',
    (n) => `Like ${n} posts.`,
    [10, 100, 500, 1000],
  ),
  ...tiered(
    'reactions-given',
    'Expressive',
    'smile',
    (n) => `React ${n} times to comments and messages.`,
    [10, 100, 500],
  ),
  ...tiered('pictures', 'Shutterbug', 'aperture', (n) => `Post ${n} pictures.`, [10, 50, 200]),
  ...tiered(
    'messages',
    'Chatterbox',
    'message-circle-more',
    (n) => `Send ${n} chat messages.`,
    [100, 1000, 5000],
  ),
  ...tiered('tags', 'Tag explorer', 'compass', (n) => `Use ${n} different hashtags.`, [5, 20, 50]),
  ...tiered(
    'amplified',
    'Amplifier',
    'megaphone',
    (n) => `Repost or quote ${n} posts.`,
    [10, 50, 100],
  ),
  ...tiered(
    'following',
    'Well connected',
    'network',
    (n) => `Follow ${n} members.`,
    [10, 25, 50, 100],
  ),
  ...tiered('collected', 'Collector', 'trophy', (n) => `Earn ${n} achievements.`, [10, 25, 50]),

  // Recognition: what others do with what the member shares.
  ...tiered(
    'followers',
    'Crowd',
    'user-round-plus',
    (n) => `${n} members follow you.`,
    [10, 25, 50, 100],
    'recognition',
  ),
  ...tiered(
    'likes-received',
    'Loved',
    'heart-pulse',
    (n) => `Your posts got ${n} likes.`,
    [10, 100, 500, 1000],
    'recognition',
  ),
  ...tiered(
    'top-post-likes',
    ['Hit', 'Smash hit', 'Legend'],
    'flame',
    (n) => `One of your posts got ${n} likes.`,
    [10, 25, 50],
    'recognition',
  ),
  ...tiered(
    'top-post-comments',
    ['Conversation starter', 'Town square'],
    'speech',
    (n) => `One of your posts got ${n} comments from others.`,
    [10, 25],
    'recognition',
  ),
  one(
    'crowd-favourite',
    'recognition',
    'top-comment-reactions',
    'Crowd favourite',
    'One of your comments got 10 reactions.',
    'star',
    10,
  ),
  ...tiered(
    'top-post-reposts',
    ['Spreading', 'Viral'],
    'share-2',
    (n) => `One of your posts was reposted or quoted ${n} times.`,
    [5, 20],
    'recognition',
  ),
  one(
    'talk-of-the-town',
    'recognition',
    'mentioned-by',
    'Talk of the town',
    '10 different members mentioned you.',
    'radio',
    10,
  ),
  one(
    'trendsetter',
    'recognition',
    'trendsetter',
    'Trendsetter',
    'You were the first to use a hashtag that five other members then used.',
    'trending-up',
  ),

  // Community
  ...tiered(
    'newcomers-welcomed',
    'Welcome committee',
    'handshake',
    (n) => `Follow or comment on ${n} newcomers in their first week.`,
    [1, 5, 20],
    'community',
  ),
  ...tiered(
    'first-responses',
    'First responder',
    'zap',
    (n) => `Write the first comment on ${n} posts of other members.`,
    [1, 10, 50],
    'community',
  ),
  ...tiered(
    'mutual-follows',
    'Inner circle',
    'orbit',
    (n) => `Follow each other with ${n} members.`,
    [5, 15, 30],
    'community',
  ),
  one(
    'crew',
    'community',
    'crew',
    'Crew',
    'A group chat you started reaches 5 members.',
    'sailboat',
    5,
  ),
  one(
    'big-table',
    'community',
    'big-table',
    'Big table',
    'Be in a group chat of 10 or more.',
    'utensils-crossed',
    10,
  ),
  ...tiered(
    'recruits',
    'Recruiter',
    'mail-plus',
    (n) => `${n} members joined through your invite.`,
    [1, 5, 10],
    'community',
  ),

  // Tenure
  tenure('member-1m', 'One month', 30, 'A month on BeSo.'),
  tenure('member-6m', 'Six months', 182, 'Half a year on BeSo.'),
  tenure('member-1y', 'One year', 365, 'A year on BeSo.'),
  tenure('member-2y', 'Two years', 730, 'Two years on BeSo.'),
  tenure('member-3y', 'Three years', 1095, 'Three years on BeSo.'),
  tenure('member-5y', 'Five years', 1826, 'Five years on BeSo.'),
  one('pioneer', 'tenure', 'pioneer', 'Pioneer', 'Here before BeSo opened its doors.', 'flag'),
  one(
    'founding-member',
    'tenure',
    'founding',
    'Founding member',
    `Joined in BeSo's first ${FOUNDING_PERIOD_DAYS} days.`,
    'landmark',
  ),
  one(
    'first-100',
    'tenure',
    'first-100',
    'One of the first 100',
    'Among the first hundred members.',
    'medal',
  ),

  // Hidden: a "?" until found. The times are the member's own (their time zone).
  secret(
    'night-owl',
    'night-owl',
    'Night owl',
    'Posted or commented between 2 and 5 at night.',
    'moon-star',
  ),
  secret(
    'early-bird',
    'early-bird',
    'Early bird',
    'Posted between 5 and 7 in the morning.',
    'sunrise',
  ),
  secret('make-a-wish', 'make-a-wish', 'Make a wish', 'Posted at 11:11.', 'sparkles'),
  secret(
    'around-the-clock',
    'around-the-clock',
    'Around the clock',
    'Posted, commented or chatted in every hour of the day.',
    'clock',
    24,
  ),
  secret(
    'weekend-warrior',
    'weekend-posts',
    'Weekend warrior',
    'Wrote 20 posts on Saturdays and Sundays.',
    'sofa',
    20,
  ),
  secret(
    'happy-new-year',
    'new-year',
    'Happy new year',
    'Posted in the first hour of the year.',
    'party-popper',
  ),
  secret('leap-of-faith', 'leap-day', 'Leap of faith', 'Posted on 29 February.', 'rabbit'),
  secret(
    'unlucky-for-some',
    'friday-13',
    'Unlucky for some',
    'Posted on a Friday the 13th.',
    'cat',
  ),
  secret(
    'trick-or-treat',
    'trick-or-treat',
    'Trick or treat',
    'Posted a 🎃 or a 👻 on Halloween.',
    'ghost',
  ),
  secret(
    'un-beso',
    'un-beso',
    'Un beso',
    'Sent a 😘 or a 💋 in a post or a message (beso is Spanish for kiss).',
    'message-circle-heart',
  ),
  secret('home-team', 'home-team', 'Home team', 'Posted with #beso.', 'house'),
  secret('speechless', 'emoji-only', 'Speechless', 'Wrote a post of emoji only.', 'laugh'),
  secret(
    'to-the-letter',
    'full-length',
    'To the letter',
    'Wrote a post of exactly 500 characters.',
    'ruler',
  ),
  secret('racecar', 'palindrome', 'Racecar', 'Wrote a post that reads the same backwards.', 'car'),
  secret(
    'quick-draw',
    'quick-draw',
    'Quick draw',
    'Replied to someone’s comment within a minute.',
    'timer',
  ),
  secret(
    'archaeologist',
    'archaeologist',
    'Archaeologist',
    'Commented on a post more than a year old.',
    'shovel',
  ),
  secret(
    'welcome-back',
    'welcome-back',
    'Welcome back',
    'Posted again after 60 days without a post.',
    'door-open',
  ),
  secret(
    'perfectionist',
    'perfectionist',
    'Perfectionist',
    'Edited a post three times.',
    'eraser',
    3,
  ),
  secret('inception', 'inception', 'Inception', 'Quoted a post that quotes another.', 'layers'),
  secret(
    'full-range',
    'full-range',
    'Full range',
    'Used all five reactions on comments.',
    'palette',
    5,
  ),
  secret(
    'talking-to-myself',
    'self-reply',
    'Talking to myself',
    'Replied to your own comment.',
    'message-circle-dashed',
  ),
  secret('detective', 'hidden-found', 'Detective', 'Found five hidden badges.', 'fingerprint', 5),
];

export const ACHIEVEMENT_BY_KEY: ReadonlyMap<string, AchievementDefinition> = new Map(
  ACHIEVEMENTS.map((achievement) => [achievement.key, achievement]),
);

export const ACHIEVEMENT_TIER_TITLES: Record<AchievementTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

/** "Storyteller (Gold)", or the title alone for a badge without tiers. */
export function achievementName(achievement: AchievementDefinition): string {
  return achievement.tier
    ? `${achievement.title} (${ACHIEVEMENT_TIER_TITLES[achievement.tier]})`
    : achievement.title;
}

/** The words of an ACHIEVEMENT_EARNED notification, in the app and in a push. */
export function achievementSentence(key: string | null): string {
  const achievement = key === null ? undefined : ACHIEVEMENT_BY_KEY.get(key);
  return achievement ? `You earned “${achievementName(achievement)}”` : 'You earned a badge';
}

/** The checklist the home feed shows a newcomer, in order; "All set" crowns it. */
export const GETTING_STARTED_KEYS = [
  'profile-picture',
  'cover-photo',
  'bio',
  'follow-3',
  'first-post',
  'first-comment',
] as const;

export const earnedAchievementSchema = z.object({
  key: z.string(),
  earnedAt: z.iso.datetime(),
});
export type EarnedAchievement = z.infer<typeof earnedAchievementSchema>;

/**
 * `GET /users/:id/achievements`: what a member earned (nothing while they hide it). The usual
 * `{ items, nextCursor }` list, never paginated (written out: `paginatedSchema` would tie this
 * entry to the main one).
 */
export const achievementListSchema = z.object({
  items: z.array(earnedAchievementSchema),
  nextCursor: z.null(),
});
export type AchievementList = z.infer<typeof achievementListSchema>;

/** `GET /users/me/achievements`: the earned ones and the count of every series, for progress. */
export const myAchievementsSchema = z.object({
  earned: z.array(earnedAchievementSchema),
  progress: z.record(z.string(), z.number().int().nonnegative()),
});
export type MyAchievements = z.infer<typeof myAchievementsSchema>;

/** `GET /achievements/stats`: how many members hold each badge, for "12 % have this". */
export const achievementStatsSchema = z.object({
  members: z.number().int().nonnegative(),
  items: z.array(z.object({ key: z.string(), holders: z.number().int().nonnegative() })),
  nextCursor: z.null(),
});
export type AchievementStats = z.infer<typeof achievementStatsSchema>;
