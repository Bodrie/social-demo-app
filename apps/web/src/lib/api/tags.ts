import {
  type PostList,
  type TrendingTagList,
  postListSchema,
  trendingTagListSchema,
} from '@beso/shared';
import { api } from './client';
import { type PageOptions, queryString } from './query';

export const fetchTagPosts = (tag: string, { cursor, signal }: PageOptions): Promise<PostList> =>
  api.get(`/tags/${encodeURIComponent(tag)}/posts${queryString({ cursor })}`, postListSchema, {
    signal,
  });

export const fetchTrendingTags = (limit: number, signal?: AbortSignal): Promise<TrendingTagList> =>
  api.get(`/tags/trending${queryString({ limit })}`, trendingTagListSchema, { signal });

/** Tags starting with `q` (what was typed after `#`), most used first. */
export const fetchTagSuggestions = (q: string, signal?: AbortSignal): Promise<TrendingTagList> =>
  api.get(`/tags/suggest${queryString({ q })}`, trendingTagListSchema, { signal });
