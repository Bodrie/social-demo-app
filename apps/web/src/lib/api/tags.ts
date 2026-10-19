import {
  type PostList,
  type TrendingTagList,
  postListSchema,
  trendingTagListSchema,
} from '@the-mesh/shared';
import { api } from './client';
import { type PageOptions, queryString } from './query';

export const fetchTagPosts = (tag: string, { cursor, signal }: PageOptions): Promise<PostList> =>
  api.get(`/tags/${encodeURIComponent(tag)}/posts${queryString({ cursor })}`, postListSchema, {
    signal,
  });

export const fetchTrendingTags = (limit: number, signal?: AbortSignal): Promise<TrendingTagList> =>
  api.get(`/tags/trending${queryString({ limit })}`, trendingTagListSchema, { signal });
