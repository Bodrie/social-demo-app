/**
 * The chat bubbles layer (plan B3a). `bubbles` are conversation ids, oldest first (the newest
 * sits nearest the corner); `windows` are the open mini threads, least recently opened first;
 * `hidden` are conversations whose bubble was dismissed, quiet until their next message.
 */
export type BubblesState = {
  bubbles: readonly string[];
  windows: readonly string[];
  hidden: ReadonlySet<string>;
};

export const EMPTY_BUBBLES: BubblesState = { bubbles: [], windows: [], hidden: new Set() };
export const MAX_BUBBLES = 4;
export const MAX_WINDOWS_DESKTOP = 2;
export const MAX_WINDOWS_PHONE = 1;

export type BubblesAction =
  /** A message from somebody else arrived in `id` while the viewer is not on the messages page. */
  | { type: 'arrive'; id: string }
  | { type: 'open'; id: string; maxWindows: number }
  | { type: 'minimise'; id: string }
  | { type: 'dismiss'; id: string }
  /** The messages page took over: every bubble and window goes. */
  | { type: 'clearAll' }
  /** The viewport changed: keep the most recent windows only. */
  | { type: 'limitWindows'; max: number };

export function bubblesReducer(state: BubblesState, action: BubblesAction): BubblesState {
  switch (action.type) {
    case 'arrive': {
      const hidden = new Set(state.hidden);
      hidden.delete(action.id);
      if (state.windows.includes(action.id)) {
        return hidden.size === state.hidden.size ? state : { ...state, hidden };
      }
      let bubbles = [...state.bubbles.filter((id) => id !== action.id), action.id];
      if (bubbles.length > MAX_BUBBLES) {
        // The oldest bubble that has no window open gives way.
        const evicted = bubbles.find((id) => !state.windows.includes(id) && id !== action.id);
        if (evicted) bubbles = bubbles.filter((id) => id !== evicted);
      }
      return { bubbles, windows: state.windows, hidden };
    }
    case 'open': {
      if (!state.bubbles.includes(action.id)) return state;
      let windows = [...state.windows.filter((id) => id !== action.id), action.id];
      if (windows.length > action.maxWindows) windows = windows.slice(-action.maxWindows);
      return { ...state, windows };
    }
    case 'minimise':
      return state.windows.includes(action.id)
        ? { ...state, windows: state.windows.filter((id) => id !== action.id) }
        : state;
    case 'dismiss': {
      const hidden = new Set(state.hidden);
      hidden.add(action.id);
      return {
        bubbles: state.bubbles.filter((id) => id !== action.id),
        windows: state.windows.filter((id) => id !== action.id),
        hidden,
      };
    }
    case 'clearAll':
      return state.bubbles.length === 0 && state.windows.length === 0
        ? state
        : { ...state, bubbles: [], windows: [] };
    case 'limitWindows':
      return state.windows.length > action.max
        ? { ...state, windows: state.windows.slice(-action.max) }
        : state;
    default:
      return state;
  }
}

/** The messages page owns the threads: no bubbles there, and arriving there clears them. */
export function isMessagesRoute(pathname: string): boolean {
  return pathname === '/messages' || pathname.startsWith('/messages/');
}
