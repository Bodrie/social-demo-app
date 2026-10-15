import { cn } from 'cn';

/** Green dot on an avatar corner; the wrapper must be `relative`. */
export function PresenceDot({ online, className }: { online: boolean; className?: string }) {
  if (!online) return null;
  return (
    <span
      className={cn(
        'bg-online ring-card absolute right-0 bottom-0 size-2.5 rounded-full ring-2',
        className,
      )}
      aria-hidden="true"
    />
  );
}
