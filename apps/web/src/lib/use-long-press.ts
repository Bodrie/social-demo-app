import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  useEffect,
  useMemo,
  useRef,
} from 'react';

type LongPressOptions = {
  /** How long the finger must stay down, in ms. */
  delay?: number;
  /** How far it may drift before the press counts as a scroll, in px. */
  slop?: number;
};

export type LongPressHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onTouchEnd: (event: ReactTouchEvent<HTMLElement>) => void;
  onMouseDown: (event: ReactMouseEvent<HTMLElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onClickCapture: (event: ReactMouseEvent<HTMLElement>) => void;
};

/**
 * Presses that start on a control are the control's (a menu trigger opens on pointer down). A
 * button marked `data-long-press` acts on a click only and lets the hold through: a chat
 * picture opens on a tap, and a hold on it is the message's.
 */
const CONTROLS = 'button:not([data-long-press]), input, textarea, select';

/**
 * Press-and-hold with a finger or a pen, the way native apps open a message's reactions. A
 * mouse never long-presses (it has hover and a menu). `onLongPress` fires once with the
 * pressed element after `delay` ms, unless the pointer drifted more than `slop` px (a scroll)
 * or was lifted first. The release of a fired press is neutralised: browsers replay a lifted
 * touch as `mousedown`/`mouseup`/`click`, and that `mousedown` would move focus to whatever
 * scrollable or `main` sits under the finger and close the popover the press opened; so the
 * `touchend` and the replayed `mousedown` are cancelled and the click is swallowed (a held link
 * does not open). The browser's own touch long-press (Android's context menu, ~400 ms, which
 * also cancels the pointer) is always suppressed inside the area, so `delay` must stay under
 * it; a mouse keeps its right-click menu. Spread the result on the element; give it
 * `select-none` on coarse pointers so the hold does not select its text instead.
 */
export function useLongPress(
  onLongPress: (element: HTMLElement) => void,
  { delay = 350, slop = 10 }: LongPressOptions = {},
): LongPressHandlers {
  const latest = useRef(onLongPress);
  useEffect(() => {
    latest.current = onLongPress;
  }, [onLongPress]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const pointerType = useRef('mouse');

  return useMemo(() => {
    const cancel = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      origin.current = null;
    };
    return {
      onPointerDown(event) {
        fired.current = false;
        pointerType.current = event.pointerType;
        if (event.pointerType === 'mouse' || !event.isPrimary || event.button !== 0) return;
        if (event.target instanceof Element && event.target.closest(CONTROLS)) return;
        cancel();
        const element = event.currentTarget;
        origin.current = { x: event.clientX, y: event.clientY };
        timer.current = setTimeout(() => {
          timer.current = null;
          origin.current = null;
          fired.current = true;
          latest.current(element);
        }, delay);
      },
      onPointerMove(event) {
        if (!origin.current) return;
        const drift = Math.hypot(
          event.clientX - origin.current.x,
          event.clientY - origin.current.y,
        );
        if (drift > slop) cancel();
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onTouchEnd(event) {
        if (fired.current) event.preventDefault();
      },
      onMouseDown(event) {
        // The replay of a finger's release, never a real mouse (its pointerdown came first).
        if (fired.current && pointerType.current !== 'mouse') event.preventDefault();
      },
      onContextMenu(event) {
        if (pointerType.current !== 'mouse') event.preventDefault();
      },
      onClickCapture(event) {
        if (!fired.current) return;
        fired.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
    };
  }, [delay, slop]);
}
