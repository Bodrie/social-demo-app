import { APP_NAME } from '@beso/shared';
import { cn } from 'cn';
import { Link } from 'react-router';
import { WORDMARK } from './logo-paths';

type WordmarkProps = {
  className?: string;
  /** `mono`: everything in the text colour (the sign-in panel, where the accent would not read). */
  variant?: 'solid' | 'mono';
};

/**
 * The brand: "Be•So" drawn as one rounded stroke, "Be" in the text colour, "So" and the dot in
 * the accent; the o is open, its top-right quarter floating off (the tab and app icons are that
 * o alone). The geometry lives in `scripts/brand-assets.mjs` (`pnpm brand`), which writes
 * `logo-paths.ts` and renders the icons and the mail header from the same drawing. The box is
 * 48 tall for a cap height of 36, so `h-[26px]` gives a B of about 19.5 px.
 */
export function Wordmark({ className, variant = 'solid' }: WordmarkProps) {
  const mono = variant === 'mono';
  return (
    <svg
      viewBox={WORDMARK.viewBox}
      aria-hidden="true"
      className={cn('h-[26px] w-auto shrink-0', className)}
      fill="none"
      strokeWidth={WORDMARK.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={WORDMARK.be} stroke="currentColor" />
      <path d={WORDMARK.so} className={mono ? 'stroke-current' : 'stroke-primary'} />
      <path d={WORDMARK.dot} className={mono ? 'fill-current' : 'fill-primary'} />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center', className)} aria-label={`${APP_NAME} home`}>
      <Wordmark />
    </Link>
  );
}
