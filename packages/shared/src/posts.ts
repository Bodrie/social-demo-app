import { z } from 'zod';
import { uuidSchema } from './common.js';
import { cursorQuerySchema, paginatedSchema } from './pagination.js';
import { postImageKeySchema, storedImageSchema } from './uploads.js';
import { userSummarySchema } from './users.js';

export const POST_MAX_LENGTH = 500;
/** Pictures per post (D2), shown as a grid on the card. */
export const POST_MAX_IMAGES = 4;

/** Kept next to `images` for tabs opened before D2 (they parse the old shape); drop it later. */
const legacyImageUrlSchema = z.string().nullable();

/**
 * The original inside a quote post, one level deep (quoting a quote shows its text, not its
 * own embed), or the frame left once the original was deleted (ADR 0017).
 */
export const postEmbedSchema = z.union([
  z.object({ unavailable: z.literal(true) }),
  z.object({
    id: z.uuid(),
    author: userSummarySchema,
    content: z.string(),
    images: z.array(storedImageSchema),
    /** @deprecated The first of `images`. */
    imageUrl: legacyImageUrlSchema,
    /** The original asks something (F3): an embed names the poll, it never shows it. */
    hasPoll: z.boolean(),
    createdAt: z.iso.datetime(),
  }),
]);
export type PostEmbed = z.infer<typeof postEmbedSchema>;
export type AvailableEmbed = Extract<PostEmbed, { id: string }>;
export const isAvailableEmbed = (embed: PostEmbed): embed is AvailableEmbed =>
  !('unavailable' in embed);

/** Polls (F3, decision P3): two to four options, one final vote, open for a set time. */
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 4;
export const POLL_OPTION_MAX_LENGTH = 80;
export const POLL_DURATIONS = ['1h', '1d', '3d', '7d'] as const;
export const pollDurationSchema = z.enum(POLL_DURATIONS);
export type PollDuration = z.infer<typeof pollDurationSchema>;
export const POLL_DURATION_HOURS: Record<PollDuration, number> = {
  '1h': 1,
  '1d': 24,
  '3d': 72,
  '7d': 168,
};
export const POLL_DURATION_LABELS: Record<PollDuration, string> = {
  '1h': '1 hour',
  '1d': '1 day',
  '3d': '3 days',
  '7d': '7 days',
};

/** The poll a new post asks; it cannot change afterwards (only the post's text can). */
export const createPollSchema = z.object({
  options: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Write the option or remove it')
        .max(POLL_OPTION_MAX_LENGTH, `At most ${POLL_OPTION_MAX_LENGTH} characters`),
    )
    .min(POLL_MIN_OPTIONS, `At least ${POLL_MIN_OPTIONS} options`)
    .max(POLL_MAX_OPTIONS, `At most ${POLL_MAX_OPTIONS} options`)
    .refine(
      (options) => new Set(options.map((option) => option.toLowerCase())).size === options.length,
      'Each option only once',
    ),
  duration: pollDurationSchema,
});
export type CreatePollInput = z.input<typeof createPollSchema>;

/**
 * A poll as the viewer sees it. `votes` per option is null until the viewer may see the
 * results: once they voted, once the poll closed, and always for its author.
 */
export const pollSchema = z.object({
  options: z.array(
    z.object({
      id: z.uuid(),
      text: z.string(),
      votes: z.int().nonnegative().nullable(),
    }),
  ),
  totalVotes: z.int().nonnegative(),
  /** The option the viewer chose; null before voting (and always for the author, who cannot). */
  myVote: z.uuid().nullable(),
  closesAt: z.iso.datetime(),
  /** As of the answer; a client also treats `closesAt` passing as closed. */
  closed: z.boolean(),
});
export type Poll = z.infer<typeof pollSchema>;

/** `PUT /posts/:id/poll/vote`: one vote, final; the answer is the post with the results. */
export const votePollSchema = z.object({ optionId: uuidSchema });
export type VotePollInput = z.infer<typeof votePollSchema>;

export const postSchema = z.object({
  id: z.uuid(),
  content: z.string(),
  /** In the order the author attached them, at most `POST_MAX_IMAGES`. */
  images: z.array(storedImageSchema),
  /** @deprecated The first of `images`. */
  imageUrl: legacyImageUrlSchema,
  author: userSummarySchema,
  likeCount: z.int().nonnegative(),
  commentCount: z.int().nonnegative(),
  /** Whether the requesting user has liked this post. */
  likedByMe: z.boolean(),
  /** The viewer's private save-for-later; nobody else's are counted or shown (C3a). */
  bookmarkedByMe: z.boolean(),
  /** Plain reposts and quotes of this post together (ADR 0017). */
  repostCount: z.int().nonnegative(),
  /** Whether the viewer has a plain repost of it; quotes are posts of their own and not toggles. */
  repostedByMe: z.boolean(),
  /** Set on a quote post: the original, or `{ unavailable: true }` once that is gone. */
  quotedPost: postEmbedSchema.nullable(),
  /** What the post asks (F3); a post has pictures or a poll, never both. */
  poll: pollSchema.nullable(),
  /** A badge the author shares (ADR 0021, "Rewards"), shown as a card under the text. */
  achievement: z.string().nullable(),
  /** On feed and profile items only: who reposted it and when; null when the item is the post itself. */
  repost: z.object({ by: userSummarySchema, at: z.iso.datetime() }).nullable(),
  /** Null until the first edit. */
  editedAt: z.iso.datetime().nullable(),
  /** Members the text mentions (`@username`), resolved when the post was saved or edited. */
  mentions: z.array(userSummarySchema),
  /** Lower-cased tags in the text, alphabetically. */
  hashtags: z.array(z.string()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Post = z.infer<typeof postSchema>;

export const postListSchema = paginatedSchema(postSchema);
export type PostList = z.infer<typeof postListSchema>;

const postInputSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Write something first')
    .max(POST_MAX_LENGTH, `At most ${POST_MAX_LENGTH} characters`),
  imageKeys: z
    .array(postImageKeySchema)
    .max(POST_MAX_IMAGES, `At most ${POST_MAX_IMAGES} pictures`)
    .refine((keys) => new Set(keys).size === keys.length, 'Each picture only once')
    .optional(),
  /** @deprecated One picture, as tabs opened before D2 send it; `imageKeys` wins when both come. */
  imageKey: postImageKeySchema.optional(),
  /** Makes the post a quote of that post; a plain repost (no text) is `PUT /posts/:id/repost` instead. */
  quotedPostId: uuidSchema.optional(),
  /** Asks a question (F3); not with pictures, not in a quote. */
  poll: createPollSchema.optional(),
  /** Shares one of the author's badges as a card; alone, without pictures, a poll or a quote. */
  achievementKey: z
    .string()
    .regex(/^[a-z0-9-]{1,64}$/, 'Unknown badge')
    .optional(),
});

export const createPostSchema = postInputSchema.superRefine((input, context) => {
  const pictures = (input.imageKeys?.length ?? 0) > 0 || input.imageKey !== undefined;
  if (input.poll && (pictures || input.quotedPostId !== undefined)) {
    context.addIssue({
      code: 'custom',
      path: ['poll'],
      message: pictures ? 'A post has pictures or a poll, not both' : 'A quote cannot ask a poll',
    });
  }
  if (input.achievementKey && (pictures || input.poll || input.quotedPostId !== undefined)) {
    context.addIssue({
      code: 'custom',
      path: ['achievementKey'],
      message: 'A badge is shared on a post of its own',
    });
  }
});
export type CreatePostInput = z.input<typeof createPostSchema>;
export type CreatePostData = z.output<typeof createPostSchema>;

/** Only the text can change; the pictures and the poll are fixed once posted. */
export const updatePostSchema = postInputSchema.pick({ content: true });
export type UpdatePostInput = z.input<typeof updatePostSchema>;
export type UpdatePostData = z.output<typeof updatePostSchema>;

export const feedQuerySchema = cursorQuerySchema;
export type FeedQuery = z.output<typeof feedQuerySchema>;

/** `GET /users/:id/posts`: with the member's plain reposts (the profile's default) or the posts alone. */
export const userPostsQuerySchema = cursorQuerySchema.extend({
  include: z.enum(['reposts', 'own']).default('reposts'),
});
export type UserPostsQuery = z.output<typeof userPostsQuerySchema>;

/** Explore (F1): everyone's posts newest first, or the most liked, commented and reposted lately. */
export const EXPLORE_SORTS = ['latest', 'popular'] as const;
export const exploreSortSchema = z.enum(EXPLORE_SORTS);
export type ExploreSort = z.infer<typeof exploreSortSchema>;
/** How far back Popular looks. */
export const EXPLORE_POPULAR_DAYS = 7;

/** `GET /explore/posts` */
export const exploreQuerySchema = cursorQuerySchema.extend({
  sort: exploreSortSchema.default('latest'),
});
export type ExploreQuery = z.output<typeof exploreQuerySchema>;

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;

/** `GET /search/posts`: full-text search over post content (`websearch_to_tsquery` syntax). */
export const searchQuerySchema = cursorQuerySchema.extend({
  q: z
    .string()
    .trim()
    .min(SEARCH_MIN_LENGTH, `At least ${SEARCH_MIN_LENGTH} characters`)
    .max(SEARCH_MAX_LENGTH, `At most ${SEARCH_MAX_LENGTH} characters`),
});
export type SearchQuery = z.output<typeof searchQuerySchema>;
