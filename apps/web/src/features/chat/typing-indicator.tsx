import { cn } from 'cn';

/** Three pulsing dots in a peer-side bubble; the text is for assistive tech. */
export function TypingIndicator({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('flex items-start', className)}>
      <div
        className="bg-muted flex h-9 items-center gap-1 rounded-2xl rounded-bl-md px-3.5"
        aria-hidden="true"
      >
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="bg-muted-foreground/70 size-1.5 rounded-full motion-safe:animate-bounce"
            style={{ animationDelay: `${index * 150}ms`, animationDuration: '1s' }}
          />
        ))}
      </div>
      <span className="sr-only">{text}</span>
    </div>
  );
}
