import { z } from 'zod';

/** Cursor-paginated list. `nextCursor` is opaque; pass it back as `?cursor=`. */
export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

export type Paginated<T> = { items: T[]; nextCursor: string | null };

/** Query parameters shared by every cursor-paginated list. */
export const cursorQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(200).optional(),
});
export type CursorQuery = z.output<typeof cursorQuerySchema>;
