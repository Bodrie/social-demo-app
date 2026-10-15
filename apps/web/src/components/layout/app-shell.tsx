import { cn } from 'cn';
import { Outlet, useMatches } from 'react-router';
import { Header } from './header';
import { LeftBar } from './left-bar';
import { RightBar } from './right-bar';

/**
 * Header plus a three-column layout. The left navigation appears from `lg`,
 * the right bar from `xl`; the middle column caps at a comfortable reading width.
 */
const isWide = (handle: unknown): boolean =>
  typeof handle === 'object' && handle !== null && 'wide' in handle && handle.wide === true;

export function AppShell() {
  // Routes with `handle: { wide: true }` (messages) take the whole middle and drop the right bar.
  const wide = useMatches().some((match) => isWide(match.handle));
  return (
    <div className="min-h-svh">
      <Header />
      <div
        className={cn(
          'mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)]',
          !wide && 'xl:grid-cols-[220px_minmax(0,1fr)_320px]',
        )}
      >
        <div className="hidden lg:block">
          <div className="sticky top-20">
            <LeftBar />
          </div>
        </div>
        <main id="main" className={cn('mx-auto w-full min-w-0', !wide && 'max-w-2xl')}>
          <Outlet />
        </main>
        {wide ? null : (
          <div className="hidden xl:block">
            <div className="sticky top-20">
              <RightBar />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
