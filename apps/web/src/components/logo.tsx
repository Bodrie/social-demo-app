import { APP_NAME } from '@beso/shared';
import { cn } from 'cn';
import { Link } from 'react-router';

type MarkProps = {
  className?: string;
  /** `outline` draws the circles as strokes with a solid lens: one colour, for the sign-in panel. */
  variant?: 'solid' | 'outline';
};

/**
 * The mark: two people meeting, drawn as two circles in the text colour with the lens where
 * they overlap in the accent (a kiss, "beso"). Works in both themes and at favicon size.
 */
export function BesoMark({ className, variant = 'solid' }: MarkProps) {
  const lens = 'M24 15.515A11 11 0 0 0 24 32.485A11 11 0 0 0 24 15.515Z';
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn('size-7 shrink-0', className)}>
      {variant === 'outline' ? (
        <>
          <circle cx="17" cy="24" r="11" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <circle cx="31" cy="24" r="11" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <path d={lens} fill="currentColor" />
        </>
      ) : (
        <>
          <circle cx="17" cy="24" r="11" fill="currentColor" />
          <circle cx="31" cy="24" r="11" fill="currentColor" />
          <path d={lens} className="fill-primary" />
        </>
      )}
    </svg>
  );
}

/** The wordmark: "Be" in the text colour, "So" in the accent, after the mark. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-lg font-semibold tracking-tight', className)}>
      Be<span className="text-primary">So</span>
    </span>
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
