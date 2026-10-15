import { BadRequestException } from '@nestjs/common';
import type { Paginated } from '@the-mesh/shared';
import { z } from 'zod';

/** Cursors are opaque to clients: the last item's id, base64url-encoded. */
export function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | undefined): string | undefined {
  if (cursor === undefined) return undefined;
  const id = Buffer.from(cursor, 'base64url').toString('utf8');
  if (!z.uuid().safeParse(id).success) {
    throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid cursor' });
  }
  return id;
}

/** Given `limit + 1` rows, trims to `limit` and computes the next cursor. */
export function paginate<Row extends { id: string }, Item>(
  rows: Row[],
  limit: number,
  map: (row: Row) => Item,
): Paginated<Item> {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return {
    items: page.map(map),
    nextCursor: hasMore && last ? encodeCursor(last.id) : null,
  };
}
