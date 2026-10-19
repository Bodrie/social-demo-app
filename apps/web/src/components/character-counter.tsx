import { cn } from 'cn';

/** Spoken only when it matters: at 20 and 10 left, at the limit, and while over it. */
function announcement(remaining: number): string {
  if (remaining < 0)
    return `${-remaining} ${remaining === -1 ? 'character' : 'characters'} over the limit`;
  if (remaining === 0) return 'Character limit reached';
  if (remaining === 10 || remaining === 20) return `${remaining} characters left`;
  return '';
}

type CharacterCounterProps = { remaining: number; className?: string };

/** The remaining characters of a text box: a number for the eye, a sentence at thresholds for the ear. */
export function CharacterCounter({ remaining, className }: CharacterCounterProps) {
  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        remaining < 0 ? 'text-destructive font-medium' : 'text-muted-foreground',
        className,
      )}
    >
      <span aria-hidden="true">{remaining}</span>
      <output className="sr-only">{announcement(remaining)}</output>
    </span>
  );
}
