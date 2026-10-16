import { REACTIONS, type ReactionSummary, type ReactionType } from '@the-mesh/shared';
import { cn } from 'cn';
import { SmilePlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type ReactionBarProps = {
  summary: ReactionSummary;
  onReact: (type: ReactionType | null) => void;
  disabled?: boolean;
};

/** Pills for the reactions a comment has, plus a picker for adding or changing yours. */
export function ReactionBar({ summary, onReact, disabled }: ReactionBarProps) {
  const [open, setOpen] = useState(false);
  const present = REACTIONS.filter((reaction) => summary.counts[reaction.type] > 0);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {present.map(({ type, emoji, label }) => {
        const mine = summary.mine === type;
        return (
          <button
            key={type}
            type="button"
            aria-pressed={mine}
            disabled={disabled}
            onClick={() => onReact(mine ? null : type)}
            className={cn(
              'flex h-7 items-center gap-1 rounded-full border px-2 text-xs tabular-nums transition-colors',
              mine
                ? 'border-primary/40 bg-accent text-accent-foreground'
                : 'bg-card hover:bg-muted text-muted-foreground',
            )}
          >
            <span aria-hidden="true">{emoji}</span>
            <span className="sr-only">{label}</span> {summary.counts[type]}
          </button>
        );
      })}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Add reaction"
            className="text-muted-foreground hover:text-foreground rounded-full"
            disabled={disabled}
          >
            <SmilePlusIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-1">
          <fieldset className="flex gap-0.5">
            <legend className="sr-only">Pick a reaction</legend>
            {REACTIONS.map(({ type, emoji, label }) => (
              <button
                key={type}
                type="button"
                aria-label={label}
                aria-pressed={summary.mine === type}
                className={cn(
                  'hover:bg-muted flex size-9 items-center justify-center rounded-lg text-xl transition-transform hover:scale-110',
                  summary.mine === type && 'bg-accent',
                )}
                onClick={() => {
                  onReact(summary.mine === type ? null : type);
                  setOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </fieldset>
        </PopoverContent>
      </Popover>
    </div>
  );
}
