import type { InfiniteData } from '@tanstack/react-query';
import type { Paginated } from '@the-mesh/shared';

/** The cache shape of every cursor-paginated list (`useInfiniteQuery` over `{ items, nextCursor }`). */
export type Pages<T> = InfiniteData<Paginated<T>>;

/** `initialPageParam` for cursor lists: the first page has no cursor. */
export const NO_CURSOR: string | undefined = undefined;

export function flattenPages<T>(data: Pages<T> | undefined): T[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

export function mapItems<T>(data: Pages<T>, update: (item: T) => T): Pages<T> {
  return { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map(update) })) };
}

export function filterItems<T>(data: Pages<T>, keep: (item: T) => boolean): Pages<T> {
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.filter(keep) })),
  };
}

/** Adds a freshly created item to the top of the first page (no-op when it is already there). */
export function prependItem<T extends { id: string }>(data: Pages<T>, item: T): Pages<T> {
  const [first, ...rest] = data.pages;
  if (!first) return { pages: [{ items: [item], nextCursor: null }], pageParams: [NO_CURSOR] };
  if (first.items.some((existing) => existing.id === item.id)) return data;
  return { ...data, pages: [{ ...first, items: [item, ...first.items] }, ...rest] };
}
