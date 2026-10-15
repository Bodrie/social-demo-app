import { type Pages, filterItems, flattenPages, mapItems, prependItem } from './infinite';

type Item = { id: string; n: number };
const pages: Pages<Item> = {
  pages: [
    { items: [{ id: 'a', n: 1 }], nextCursor: 'a' },
    { items: [{ id: 'b', n: 2 }], nextCursor: null },
  ],
  pageParams: [undefined, 'a'],
};

describe('infinite page helpers', () => {
  it('flattens, maps and filters across pages', () => {
    expect(flattenPages(pages).map((i) => i.id)).toEqual(['a', 'b']);
    expect(flattenPages(undefined)).toEqual([]);
    expect(flattenPages(mapItems(pages, (i) => ({ ...i, n: i.n * 10 }))).map((i) => i.n)).toEqual([
      10, 20,
    ]);
    expect(flattenPages(filterItems(pages, (i) => i.id !== 'a')).map((i) => i.id)).toEqual(['b']);
  });

  it('prepends to the first page once', () => {
    const next = prependItem(pages, { id: 'c', n: 3 });
    expect(flattenPages(next).map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(prependItem(next, { id: 'c', n: 3 })).toBe(next);
    expect(
      flattenPages(prependItem({ pages: [], pageParams: [] }, { id: 'z', n: 0 })),
    ).toHaveLength(1);
  });
});
