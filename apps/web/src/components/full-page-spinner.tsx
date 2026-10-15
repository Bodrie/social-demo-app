import { Loader2Icon } from 'lucide-react';

export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  // <output> carries role="status" and a polite live region by itself.
  return (
    <output className="text-muted-foreground flex min-h-svh items-center justify-center gap-2">
      <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}…</span>
    </output>
  );
}
