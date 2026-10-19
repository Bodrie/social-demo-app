import { Suspense, lazy, useEffect, useReducer, useRef } from 'react';
import { useLocation } from 'react-router';
import { useCurrentUser } from '@/features/auth/current-user';
import { MD_UP, useMediaQuery } from '@/lib/use-media-query';
import { useChat } from '../chat-context';
import {
  EMPTY_BUBBLES,
  MAX_WINDOWS_DESKTOP,
  MAX_WINDOWS_PHONE,
  bubblesReducer,
  isMessagesRoute,
} from './bubbles-state';

// The dock (windows with a thread and a composer) is its own chunk; this file stays small
// because it ships with the shell.
const BubbleDock = lazy(() => import('./bubble-dock'));

/**
 * Chat bubbles (plan B3a): a message from someone else that arrives while the viewer is not on
 * the messages page shows up as a bubble in the corner (a row at the top on phones); a bubble
 * opens a small window with the thread. Mounted by the shell when the preference is on.
 */
export function ChatBubbles() {
  const me = useCurrentUser();
  const { subscribeToMessages } = useChat();
  const { pathname } = useLocation();
  const onMessagesPage = isMessagesRoute(pathname);
  const phone = !useMediaQuery(MD_UP);
  const maxWindows = phone ? MAX_WINDOWS_PHONE : MAX_WINDOWS_DESKTOP;
  const [state, dispatch] = useReducer(bubblesReducer, EMPTY_BUBBLES);

  // The subscription outlives renders; it reads the current route through a ref.
  const onMessagesPageRef = useRef(onMessagesPage);
  useEffect(() => {
    onMessagesPageRef.current = onMessagesPage;
    if (onMessagesPage) dispatch({ type: 'clearAll' });
  }, [onMessagesPage]);

  useEffect(
    () =>
      subscribeToMessages((message) => {
        if (message.senderId === me.id || onMessagesPageRef.current) return;
        dispatch({ type: 'arrive', id: message.conversationId });
      }),
    [subscribeToMessages, me.id],
  );

  useEffect(() => {
    dispatch({ type: 'limitWindows', max: maxWindows });
  }, [maxWindows]);

  if (onMessagesPage || state.bubbles.length === 0) return null;
  return (
    <Suspense fallback={null}>
      <BubbleDock
        state={state}
        phone={phone}
        onOpen={(id) => dispatch({ type: 'open', id, maxWindows })}
        onMinimise={(id) => dispatch({ type: 'minimise', id })}
        onDismiss={(id) => dispatch({ type: 'dismiss', id })}
      />
    </Suspense>
  );
}
