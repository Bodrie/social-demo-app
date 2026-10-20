import type { Paginated } from '@beso/shared';
import { z } from 'zod';
import { validationError } from './errors.js';

/**
 * Keyset pagination. Lists are ordered by `createdAt desc, <id> desc`; the
 * cursor carries both values of the last item, so a page continues correctly
 * even when that item has since been deleted (a row-id cursor would not).
 */
export type Keyset = { createdAt: Date; id: string };

const cursorSchema = z.tuple([z.iso.datetime(), z.uuid()]);

export function encodeCursor(key: Keyset): string {
  return Buffer.from(`${key.createdAt.toISOString()}|${key.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | undefined): Keyset | undefined {
  if (cursor === undefined) return undefined;
  const parsed = cursorSchema.safeParse(
    Buffer.from(cursor, 'base64url').toString('utf8').split('|'),
  );
  if (!parsed.success) throw validationError({ cursor: 'Invalid cursor' });
  return { createdAt: new Date(parsed.data[0]), id: parsed.data[1] };
}

/**
 * WHERE fragment selecting rows that come after `cursor` in `createdAt desc, id desc`
 * order. `idWhere` builds the id comparison for the model's id column.
 */
export function keysetAfter<IdWhere extends object>(
  cursor: Keyset,
  idWhere: (id: string) => IdWhere,
) {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, ...idWhere(cursor.id) },
    ],
  };
}

/** `keysetAfter` for the few lists read the other way (`createdAt asc, id asc`), e.g. replies. */
export function keysetAfterAscending<IdWhere extends object>(
  cursor: Keyset,
  idWhere: (id: string) => IdWhere,
) {
  return {
    OR: [
      { createdAt: { gt: cursor.createdAt } },
      { createdAt: cursor.createdAt, ...idWhere(cursor.id) },
    ],
  };
}

/**
 * Keyset for lists ranked by an integer score first (`score desc, createdAt desc, id desc`),
 * e.g. comments sorted by number of reactions.
 */
export type RankedKeyset = Keyset & { score: number };

const rankedCursorSchema = z.tuple([
  z.coerce.number().int().nonnegative(),
  z.iso.datetime(),
  z.uuid(),
]);

export function encodeRankedCursor(key: RankedKeyset): string {
  return Buffer.from(`${key.score}|${key.createdAt.toISOString()}|${key.id}`, 'utf8').toString(
    'base64url',
  );
}

export function decodeRankedCursor(cursor: string | undefined): RankedKeyset | undefined {
  if (cursor === undefined) return undefined;
  const parsed = rankedCursorSchema.safeParse(
    Buffer.from(cursor, 'base64url').toString('utf8').split('|'),
  );
  if (!parsed.success) throw validationError({ cursor: 'Invalid cursor' });
  return { score: parsed.data[0], createdAt: new Date(parsed.data[1]), id: parsed.data[2] };
}

/** Given `limit + 1` rows, trims to `limit` and encodes the next cursor from the last kept row. */
export function paginateWith<Row, Item>(
  rows: Row[],
  limit: number,
  nextCursorOf: (row: Row) => string,
  map: (row: Row) => Item,
): Paginated<Item> {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return {
    items: page.map(map),
    nextCursor: hasMore && last !== undefined ? nextCursorOf(last) : null,
  };
}

/** `paginateWith` for the standard `createdAt desc, id desc` order. */
export function paginateBy<Row, Item>(
  rows: Row[],
  limit: number,
  cursorOf: (row: Row) => Keyset,
  map: (row: Row) => Item,
): Paginated<Item> {
  return paginateWith(rows, limit, (row) => encodeCursor(cursorOf(row)), map);
}

/** `paginateBy` for rows that carry `id` and `createdAt`. */
export function paginate<Row extends Keyset, Item>(
  rows: Row[],
  limit: number,
  map: (row: Row) => Item,
): Paginated<Item> {
  return paginateBy(rows, limit, (row) => ({ createdAt: row.createdAt, id: row.id }), map);
}
