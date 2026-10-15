type Observed = {
  callback: IntersectionObserverCallback;
  elements: Set<Element>;
  observer: IntersectionObserver;
};
const registry = new Set<Observed>();

/** jsdom has no IntersectionObserver; this one is driven by `intersectAll()` from tests. */
export class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  readonly #entry: Observed;

  constructor(callback: IntersectionObserverCallback) {
    this.#entry = { callback, elements: new Set(), observer: this };
    registry.add(this.#entry);
  }

  observe(target: Element): void {
    this.#entry.elements.add(target);
  }

  unobserve(target: Element): void {
    this.#entry.elements.delete(target);
  }

  disconnect(): void {
    this.#entry.elements.clear();
    registry.delete(this.#entry);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

/** Reports every observed element as visible. */
export function intersectAll(): void {
  for (const { callback, elements, observer } of registry) {
    const entries = [...elements].map((target) => {
      const rect = target.getBoundingClientRect();
      return {
        target,
        isIntersecting: true,
        intersectionRatio: 1,
        time: 0,
        boundingClientRect: rect,
        intersectionRect: rect,
        rootBounds: null,
      };
    });
    if (entries.length > 0) callback(entries, observer);
  }
}

export function observedElementCount(): number {
  let count = 0;
  for (const { elements } of registry) count += elements.size;
  return count;
}
