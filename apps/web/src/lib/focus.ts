import type { RefObject } from 'react';

/** Focuses `ref` once the current render has settled (after an editor or dialog unmounted). */
export function focusLater(ref: RefObject<HTMLElement | null>): void {
  requestAnimationFrame(() => ref.current?.focus());
}
