import { useEffect, useRef, useState } from 'react';

type Options = {
  /** Observe only while there is something to load and nothing in flight. */
  enabled: boolean;
  onReachEnd: () => void;
  /** Start loading before the sentinel is actually visible. */
  rootMargin?: string;
};

/** Returns a ref callback for a sentinel element; `onReachEnd` fires when it scrolls into view. */
export function useInfiniteScroll({ enabled, onReachEnd, rootMargin = '600px 0px' }: Options) {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const latest = useRef(onReachEnd);
  useEffect(() => {
    latest.current = onReachEnd;
  }, [onReachEnd]);

  useEffect(() => {
    if (!sentinel || !enabled) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) latest.current();
      },
      { rootMargin },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, enabled, rootMargin]);

  return setSentinel;
}
