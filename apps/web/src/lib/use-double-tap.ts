import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
} from 'react';

type DoubleTapOptions = {
  /** The longest pause between the two taps, in ms. */
  interval?: number;
  /** How far apart the two taps may land, in px. */
  slop?: number;
};

/** Where the second tap landed, relative to the element the handlers sit on. */
export type TapPoint = { x: number; y: number };

export type DoubleTap = {
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
    onClickCapture: (event: ReactMouseEvent<HTMLElement>) => void;
  };
  /**
   * A single tap's own action (a picture opening), held back after a finger's tap until a
   * second one can no longer come; a mouse click runs it at once.
   */
  single: (action: () => void) => void;
};

/**
 * Taps on these are theirs (a link opens, a vote counts). A button marked `data-double-tap`
 * lets the gesture through and defers its own action with `single`: a post's picture.
 */
const OWN_TAPS = 'a, input, textarea, select, button:not([data-double-tap])';

/**
 * Two quick taps with a finger or a pen, the way phone apps like a post. A mouse never
 * double-taps (a double click selects a word, as it should). The second tap's click is
 * swallowed and whatever text the browser selected for it is let go; give the element
 * `touch-manipulation` so the browser does not zoom on the gesture instead.
 */
export function useDoubleTap(
  onDoubleTap: (point: TapPoint) => void,
  { interval = 300, slop = 30 }: DoubleTapOptions = {},
): DoubleTap {
  const latest = useRef(onDoubleTap);
  useEffect(() => {
    latest.current = onDoubleTap;
  }, [onDoubleTap]);
  const last = useRef<{ time: number; x: number; y: number } | null>(null);
  const pointerType = useRef('mouse');
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swallow = useRef(false);
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );

  return useMemo(() => {
    const cancelPending = () => {
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
    };
    return {
      handlers: {
        onPointerDown(event) {
          pointerType.current = event.pointerType;
        },
        onPointerUp(event) {
          if (event.pointerType === 'mouse' || !event.isPrimary) return;
          if (event.target instanceof Element && event.target.closest(OWN_TAPS)) {
            last.current = null;
            return;
          }
          const now = event.timeStamp;
          const previous = last.current;
          const close =
            previous !== null &&
            now - previous.time <= interval &&
            Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= slop;
          if (!close) {
            last.current = { time: now, x: event.clientX, y: event.clientY };
            return;
          }
          last.current = null;
          cancelPending();
          swallow.current = true;
          window.getSelection()?.removeAllRanges();
          const box = event.currentTarget.getBoundingClientRect();
          latest.current({ x: event.clientX - box.left, y: event.clientY - box.top });
        },
        onClickCapture(event) {
          if (!swallow.current) return;
          swallow.current = false;
          event.preventDefault();
          event.stopPropagation();
        },
      },
      single(action) {
        cancelPending();
        if (pointerType.current === 'mouse') {
          action();
          return;
        }
        pending.current = setTimeout(() => {
          pending.current = null;
          action();
        }, interval);
      },
    };
  }, [interval, slop]);
}
