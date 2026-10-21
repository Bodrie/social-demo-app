import { APP_NAME } from '@beso/shared';
import { cn } from 'cn';
import { Link } from 'react-router';
import { MARK, WORDMARK } from './logo-paths';

type BrandProps = {
  className?: string;
  /** `mono`: everything in the text colour (the sign-in panel, where the accent would not read). */
  variant?: 'solid' | 'mono';
};

/**
 * The mark: a lowercase b whose bowl is a message bubble, drawn as one rounded stroke, with a
 * heart in it (a kiss, "beso"). The strokes take the text colour, the heart the accent. The
 * geometry lives in `scripts/brand-assets.mjs` (`pnpm brand`), which writes `logo-paths.ts`
 * and renders the favicons, the touch icon and the mail header from the same drawing.
 */
export function BesoMark({ className, variant = 'solid' }: BrandProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={cn('size-7 shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={MARK.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={MARK.letter} />
      <path
        d={MARK.heart}
        stroke="none"
        className={variant === 'mono' ? 'fill-current' : 'fill-primary'}
      />
    </svg>
  );
}

/**
 * The wordmark: "BeSo" as the reference logotype, traced into filled outlines (no font is
 * loaded for it; `scripts/wordmark.json` holds the trace); "So" in the accent. The box is 48
 * tall for a cap height of 40, so `h-[19px]` gives a 16 px B.
 */
export function Wordmark({ className, variant = 'solid' }: BrandProps) {
  return (
    <svg
      viewBox={WORDMARK.viewBox}
      aria-hidden="true"
      className={cn('h-[19px] w-auto shrink-0', className)}
      fillRule="evenodd"
    >
      <path d={WORDMARK.be} fill="currentColor" />
      <path d={WORDMARK.so} className={variant === 'mono' ? 'fill-current' : 'fill-primary'} />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn('flex items-center gap-2', className)}
      aria-label={`${APP_NAME} home`}
    >
      <BesoMark />
      <Wordmark />
    </Link>
  );
}
