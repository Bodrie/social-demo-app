import { BadRequestException } from '@nestjs/common';
import { decodeCursor, encodeCursor, keysetAfter, paginate, paginateBy } from './pagination.js';

const at = (iso: string) => new Date(iso);
const rows = [
  { id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b3', createdAt: at('2026-10-15T10:00:03.000Z') },
  { id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b2', createdAt: at('2026-10-15T10:00:02.000Z') },
  { id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b1', createdAt: at('2026-10-15T10:00:01.000Z') },
];

describe('cursor encoding', () => {
  it('round-trips the keyset through an opaque string', () => {
    const cursor = encodeCursor(rows[0]!);
    expect(cursor).not.toContain(rows[0]!.id);
    expect(decodeCursor(cursor)).toEqual(rows[0]);
  });

  it('treats a missing cursor as the first page', () => {
    expect(decodeCursor(undefined)).toBeUndefined();
  });

  it('rejects garbage and bare ids as a validation error on the cursor field', () => {
    for (const bad of [
      'zzz',
      Buffer.from(rows[0]!.id).toString('base64url'),
      Buffer.from('x|y').toString('base64url'),
    ]) {
      expect(() => decodeCursor(bad)).toThrow(BadRequestException);
    }
    try {
      decodeCursor('zzz');
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: { cursor: 'Invalid cursor' },
      });
    }
  });
});

describe('keysetAfter', () => {
  it('selects strictly older rows or same-instant rows with a smaller id', () => {
    expect(keysetAfter(rows[1]!, (id) => ({ id: { lt: id } }))).toEqual({
      OR: [
        { createdAt: { lt: rows[1]!.createdAt } },
        { createdAt: rows[1]!.createdAt, id: { lt: rows[1]!.id } },
      ],
    });
  });
});

describe('paginate', () => {
  it('returns a next cursor when more rows than the limit were fetched', () => {
    const page = paginate(rows, 2, (row) => row.id);
    expect(page.items).toEqual([rows[0]!.id, rows[1]!.id]);
    expect(page.nextCursor).toBe(encodeCursor(rows[1]!));
  });

  it('returns null when the fetched rows fit the limit', () => {
    expect(paginate(rows, 3, (row) => row.id).nextCursor).toBeNull();
    expect(paginate([], 3, (row: (typeof rows)[number]) => row.id)).toEqual({
      items: [],
      nextCursor: null,
    });
  });
});

describe('paginateBy', () => {
  it('derives the keyset from any fields', () => {
    const follows = rows.map((row) => ({ followerId: row.id, createdAt: row.createdAt }));
    const page = paginateBy(
      follows,
      2,
      (row) => ({ createdAt: row.createdAt, id: row.followerId }),
      (row) => row.followerId.slice(-1),
    );
    expect(page.items).toEqual(['3', '2']);
    expect(page.nextCursor).toBe(encodeCursor(rows[1]!));
  });
});
