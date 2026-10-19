import { useSyncExternalStore } from 'react';

/** Tailwind's `md` breakpoint, where the layout gets a left navigation column. */
export const MD_UP = '(min-width: 768px)';

/** Whether `query` matches now, re-rendering when that changes. False where `matchMedia` is missing. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  );
}
