import { APP_NAME } from '@the-mesh/shared';
import { cn } from 'cn';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { CONTACT_EMAIL, REPOSITORY_URL } from '@/lib/env';
import { usePageTitle } from '@/lib/use-page-title';

/** Keep in step with the text: both pages print it, and a change in the text is a change in the date. */
export const LEGAL_UPDATED_ON = '16 October 2026';

type LegalLayoutProps = {
  title: string;
  intro: string;
  children: ReactNode;
};

const PAGES = [
  { to: '/privacy', label: 'Privacy notice' },
  { to: '/terms', label: 'Terms of use' },
];

/** Long-form pages readable signed in or not: brand header, a small switcher, one column of prose. */
export function LegalLayout({ title, intro, children }: LegalLayoutProps) {
  usePageTitle(title);
  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-16 sm:px-6">
        <nav aria-label="Legal pages" className="mb-8">
          <ul className="flex gap-2">
            {PAGES.map((page) => (
              <li key={page.to}>
                <NavLink
                  to={page.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  {page.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <article className="space-y-10">
          <header className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground text-sm">Last updated {LEGAL_UPDATED_ON}</p>
            <p className="text-[15px]/7">{intro}</p>
          </header>
          {children}
        </article>
      </main>
      <footer className="text-muted-foreground mx-auto w-full max-w-3xl px-4 pb-8 text-xs sm:px-6">
        {APP_NAME} · a demo social network ·{' '}
        <Link to="/" className="hover:text-foreground underline-offset-4 hover:underline">
          Back to the app
        </Link>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-[15px]/7">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

/** "How to reach us", shared by both pages so the channel is stated once. */
export function ContactLine() {
  if (CONTACT_EMAIL) {
    return (
      <p>
        You can reach us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    );
  }
  return (
    <p>
      You can reach us through the project's{' '}
      <a
        href={`${REPOSITORY_URL}/issues`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-4"
      >
        issue tracker
      </a>
      .
    </p>
  );
}
