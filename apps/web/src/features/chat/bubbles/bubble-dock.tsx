import { useRef } from 'react';
import type { BubblesState } from './bubbles-state';
import { ChatBubble } from './chat-bubble';
import { ChatWindow } from './chat-window';

type BubbleDockProps = {
  state: BubblesState;
  /** Below `md`: a row under the header and one full-width panel instead of a column and windows. */
  phone: boolean;
  onOpen: (id: string) => void;
  onMinimise: (id: string) => void;
  onDismiss: (id: string) => void;
};

/**
 * The layer itself. Above the page (`z-30`), below dialogs, sheets and toasts (`z-50`), and
 * transparent to clicks wherever it draws nothing.
 */
export default function BubbleDock({
  state,
  phone,
  onOpen,
  onMinimise,
  onDismiss,
}: BubbleDockProps) {
  const bubbleButtons = useRef(new Map<string, HTMLButtonElement>());
  const registerBubble = (id: string) => (element: HTMLButtonElement | null) => {
    if (element) bubbleButtons.current.set(id, element);
    else bubbleButtons.current.delete(id);
  };
  // Minimising hands focus back to the bubble the window came from.
  const minimise = (id: string) => {
    onMinimise(id);
    requestAnimationFrame(() => bubbleButtons.current.get(id)?.focus());
  };

  if (phone) {
    const active = state.windows.at(-1) ?? null;
    return (
      <div className="pointer-events-none fixed inset-x-0 top-14 bottom-0 z-30 flex flex-col">
        <ul
          aria-label="Chat bubbles"
          className="bg-card/95 supports-[backdrop-filter]:bg-card/80 pointer-events-auto flex gap-3 overflow-x-auto border-b px-3 py-2 backdrop-blur-md"
        >
          {state.bubbles.map((id) => (
            <ChatBubble
              key={id}
              id={id}
              ref={registerBubble(id)}
              active={active === id}
              alwaysShowHide
              onOpen={() => (active === id ? minimise(id) : onOpen(id))}
              onDismiss={() => onDismiss(id)}
            />
          ))}
        </ul>
        {active ? (
          <ChatWindow
            key={active}
            id={active}
            phone
            className="pointer-events-auto"
            onMinimise={() => minimise(active)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed right-4 bottom-0 z-30 flex items-end gap-3">
      {state.windows.map((id) => (
        <ChatWindow
          key={id}
          id={id}
          className="pointer-events-auto"
          onMinimise={() => minimise(id)}
        />
      ))}
      <ul
        aria-label="Chat bubbles"
        className="pointer-events-auto flex flex-col items-center gap-2 pb-4"
      >
        {state.bubbles.map((id) => (
          <ChatBubble
            key={id}
            id={id}
            ref={registerBubble(id)}
            active={state.windows.includes(id)}
            onOpen={() => onOpen(id)}
            onDismiss={() => onDismiss(id)}
          />
        ))}
      </ul>
    </div>
  );
}
