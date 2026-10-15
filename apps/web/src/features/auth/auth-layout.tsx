import { APP_NAME } from '@the-mesh/shared';
import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';

type AuthLayoutProps = { title: string; children: ReactNode; aside: ReactNode };

/** Two-pane page for sign in / sign up, mirroring the legacy layout. */
export function AuthLayout({ title, children, aside }: AuthLayoutProps) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-between px-4">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="bg-card grid w-full max-w-4xl overflow-hidden rounded-xl border shadow-sm md:grid-cols-2">
          <section className="bg-primary text-primary-foreground hidden flex-col justify-center gap-4 p-10 md:flex">
            <h1 className="text-4xl font-bold">{APP_NAME}</h1>
            <div className="space-y-3 text-sm/6 opacity-90">{aside}</div>
          </section>
          <section className="flex flex-col justify-center gap-6 p-8">
            <h2 className="text-2xl font-semibold">{title}</h2>
            {children}
          </section>
        </div>
      </main>
    </div>
  );
}
