import { APP_NAME } from '@the-mesh/shared';
import { ImageIcon, MessageCircleIcon, UsersIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import logoDark from '@/assets/logo-dark.svg';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { usePageTitle } from '@/lib/use-page-title';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Link to the other auth page. */
  footer: ReactNode;
};

const HIGHLIGHTS = [
  { icon: ImageIcon, title: 'Posts with pictures', text: 'Share a moment, react, comment.' },
  {
    icon: UsersIcon,
    title: 'Your own circle',
    text: 'Follow the people you care about; the feed is only them.',
  },
  {
    icon: MessageCircleIcon,
    title: 'Talk in realtime',
    text: 'See who is online and message them straight away.',
  },
];

/**
 * Sign in / sign up: a brand panel on wide screens, a focused form on the right.
 * The panel is purely visual (hidden below `lg`), so nothing in it is required to use the page.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  usePageTitle(title);
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <aside
        aria-hidden="true"
        className="auth-panel relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14"
      >
        <div className="auth-panel-grid pointer-events-none absolute inset-0" />
        <img src={logoDark} alt="" className="relative h-8 w-auto self-start" />
        <div className="relative max-w-md space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance xl:text-5xl">
              Your people, one feed.
            </h2>
            <p className="text-lg/7 text-white/75">
              {APP_NAME} is a small social network: share what matters, follow friends and talk the
              moment they are online.
            </p>
          </div>
          <ul className="space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, title: itemTitle, text }) => (
              <li key={itemTitle} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15 ring-inset">
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block font-medium">{itemTitle}</span>
                  <span className="block text-sm text-white/70">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">{APP_NAME} · a demo social network</p>
      </aside>

      <div className="flex min-h-svh flex-col lg:min-h-0">
        <header className="flex items-center justify-between px-4 py-3 sm:px-6">
          <Logo className="lg:invisible" />
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="text-muted-foreground text-sm/6">{subtitle}</p>
            </div>
            {children}
            <p className="text-muted-foreground text-center text-sm">{footer}</p>
            <p className="text-muted-foreground text-center text-xs">
              <Link
                to="/privacy"
                className="hover:text-foreground underline-offset-4 hover:underline"
              >
                Privacy notice
              </Link>
              {' · '}
              <Link
                to="/terms"
                className="hover:text-foreground underline-offset-4 hover:underline"
              >
                Terms of use
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
