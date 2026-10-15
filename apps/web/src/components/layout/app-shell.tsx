import { Outlet } from 'react-router';
import { Header } from './header';
import { LeftBar } from './left-bar';
import { RightBar } from './right-bar';

/** Header plus a three-column layout; the sidebars collapse below the lg breakpoint. */
export function AppShell() {
  return (
    <div className="min-h-svh">
      <Header />
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <div className="hidden lg:block">
          <div className="sticky top-20">
            <LeftBar />
          </div>
        </div>
        <main id="main" className="min-w-0">
          <Outlet />
        </main>
        <div className="hidden lg:block">
          <div className="sticky top-20">
            <RightBar />
          </div>
        </div>
      </div>
    </div>
  );
}
