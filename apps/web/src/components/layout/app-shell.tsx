import { cn } from 'cn';
import { Suspense, lazy, useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation, useMatches } from 'react-router';
import { useCurrentUser } from '@/features/auth/current-user';
import { ChatBubbles } from '@/features/chat/bubbles/chat-bubbles';
import { useUnreadCount } from '@/features/chat/use-conversations';
import { useDocumentBadge } from '@/lib/use-document-badge';
import { Header } from './header';
import { LeftBar } from './left-bar';
import { NavigationProgress } from './navigation-progress';
import { RightBar } from './right-bar';

// Sound and browser notifications are off by default: their code loads only for people who
// turned one on, keeping the first paint small.
const MessageAlerts = lazy(() => import('@/features/chat/message-alerts'));

const isWide = (handle: unknown): boolean =>
  typeof handle === 'object' && handle !== null && 'wide' in handle && handle.wide === true;

/**
 * Header plus a three-column layout. The left navigation appears from `lg`, the
 * right bar from `xl`; routes with `handle: { wide: true }` (messages) take the
 * whole middle and drop the right bar. Sidebars taller than the viewport scroll on their
 * own instead of being cut off. After a navigation that started outside the
 * main area (header, left bar), focus moves to the new page content.
 */
export function AppShell() {
  const me = useCurrentUser();
  const wide = useMatches().some((match) => isWide(match.handle));
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  // "(3) Home · The Mesh": the unread total travels in the tab title.
  useDocumentBadge(useUnreadCount());

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const main = mainRef.current;
    if (main && !main.contains(document.activeElement)) main.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="min-h-svh">
      <NavigationProgress />
      <ScrollRestoration />
      <Header />
      <div
        className={cn(
          'mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)]',
          !wide && 'xl:grid-cols-[220px_minmax(0,1fr)_320px]',
        )}
      >
        <div className="hidden lg:block">
          <div className="sidebar-column sticky top-20 max-h-[calc(100svh-6.5rem)] overflow-y-auto overscroll-contain">
            <LeftBar />
          </div>
        </div>
        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className={cn('mx-auto w-full min-w-0 outline-none', !wide && 'max-w-2xl')}
        >
          <Outlet />
        </main>
        {wide ? null : (
          <div className="hidden xl:block">
            <div className="sidebar-column sticky top-20 max-h-[calc(100svh-6.5rem)] overflow-y-auto overscroll-contain">
              <RightBar />
            </div>
          </div>
        )}
      </div>
      {me.settings.chatBubbles ? <ChatBubbles /> : null}
      {me.settings.messageSound || me.settings.browserNotifications ? (
        <Suspense fallback={null}>
          <MessageAlerts />
        </Suspense>
      ) : null}
    </div>
  );
}
