import { z } from 'zod';

/** Cursor-paginated list. `nextCursor` is opaque; pass it back as `?cursor=`. */
export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

export type Paginated<T> = { items: T[]; nextCursor: string | null };
