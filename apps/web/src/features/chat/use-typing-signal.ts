import { useCallback, useEffect, useRef } from 'react';

/** Re-announce while the keys keep going, so the other side's expiry never fires mid-sentence. */
export const TYPING_REFRESH_MS = 2500;
/** No keystroke for this long counts as having stopped. */
export const TYPING_IDLE_MS = 3000;

/**
 * Turns keystrokes into a sparse typing signal: `true` on the first key and every few
 * seconds after, `false` after a pause, on send and on unmount. `signal` is the sink.
 */
export function useTypingSignal(signal: (typing: boolean) => void) {
  const active = useRef(false);
  const lastSentAt = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sink = useRef(signal);
  useEffect(() => {
    sink.current = signal;
  }, [signal]);

  const stop = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    if (!active.current) return;
    active.current = false;
    sink.current(false);
  }, []);

  const typed = useCallback(() => {
    const now = Date.now();
    if (!active.current || now - lastSentAt.current >= TYPING_REFRESH_MS) {
      active.current = true;
      lastSentAt.current = now;
      sink.current(true);
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stop, TYPING_IDLE_MS);
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { typed, stop };
}
