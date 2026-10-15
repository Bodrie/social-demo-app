import { BadRequestException } from '@nestjs/common';
import { decodeCursor, encodeCursor, paginate } from './pagination.js';

const ids = [
  '01a13ed6-d3ec-71cb-b39f-fbc256a293b1',
  '01a13ed6-d3ec-71cb-b39f-fbc256a293b2',
  '01a13ed6-d3ec-71cb-b39f-fbc256a293b3',
];

describe('cursor encoding', () => {
  it('round-trips an id through an opaque string', () => {
    const cursor = encodeCursor(ids[0]!);
    expect(cursor).not.toContain(ids[0]);
    expect(decodeCursor(cursor)).toBe(ids[0]);
  });

  it('treats a missing cursor as the first page', () => {
    expect(decodeCursor(undefined)).toBeUndefined();
  });

  it('rejects cursors that do not decode to a uuid', () => {
    expect(() => decodeCursor('zzz')).toThrow(BadRequestException);
  });
});

describe('paginate', () => {
  const rows = ids.map((id) => ({ id }));

  it('returns a next cursor when more rows than the limit were fetched', () => {
    const page = paginate(rows, 2, (row) => row.id);
    expect(page.items).toEqual([ids[0], ids[1]]);
    expect(page.nextCursor).toBe(encodeCursor(ids[1]!));
  });

  it('returns null when the fetched rows fit the limit', () => {
    expect(paginate(rows, 3, (row) => row.id).nextCursor).toBeNull();
    expect(paginate([], 3, (row: { id: string }) => row.id)).toEqual({ items: [], nextCursor: null });
  });
});
