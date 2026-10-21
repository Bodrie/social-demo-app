import { REACTIONS, type ReactionSummary, type ReactionType } from '@beso/shared';
import { cn } from 'cn';
import { SmilePlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type PressProps = {
  /**
   * A press-and-hold on the bubble (`LongPressArea`): while set, the picker is open and sits
   * over that element instead of under its button.
   */
  pressedOn?: HTMLElement | null;
  /** The picker closed (a pick, Escape, a tap outside): the parent clears `pressedOn`. */
  onClose?: () => void;
};

type ReactionPickerProps = PressProps & {
  mine: ReactionType | null;
  onReact: (type: ReactionType | null) => void;
  disabled?: boolean;
  align?: 'start' | 'end';
  className?: string;
};

/** The "Add reaction" button with its popover of emojis; picking yours again removes it. */
export function ReactionPicker({
  mine,
  onReact,
  disabled,
  align = 'start',
  className,
  pressedOn = null,
  onClose,
}: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const anchor = useMemo(() => (pressedOn ? { current: pressedOn } : null), [pressedOn]);
  const change = (next: boolean) => {
    setOpen(next);
    if (!next) onClose?.();
  };
  return (
    <Popover open={open || anchor !== null} onOpenChange={change}>
      {anchor ? <PopoverAnchor virtualRef={anchor} /> : null}
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Add reaction"
          className={cn('text-muted-foreground hover:text-foreground rounded-full', className)}
          disabled={disabled}
        >
          <SmilePlusIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={anchor ? 'center' : align}
        side={anchor ? 'top' : 'bottom'}
        className="w-auto p-1"
      >
        <fieldset className="flex gap-0.5">
          <legend className="sr-only">Pick a reaction</legend>
          {REACTIONS.map(({ type, emoji, label }) => (
            <button
              key={type}
              type="button"
              aria-label={label}
              aria-pressed={mine === type}
              className={cn(
                'hover:bg-muted flex size-9 items-center justify-center rounded-lg text-xl transition-transform hover:scale-110',
                mine === type && 'bg-accent',
              )}
              onClick={() => {
                onReact(mine === type ? null : type);
                change(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}

type ReactionBarProps = PressProps & {
  summary: ReactionSummary;
  onReact: (type: ReactionType | null) => void;
  disabled?: boolean;
  /** Without the picker: pills only (chat puts the picker next to the bubble instead). */
  picker?: boolean;
  className?: string;
};

/** Pills for the reactions a comment or message has, plus a picker for adding or changing yours. */
export function ReactionBar({
  summary,
  onReact,
  disabled,
  picker = true,
  className,
  pressedOn,
  onClose,
}: ReactionBarProps) {
  const present = REACTIONS.filter((reaction) => summary.counts[reaction.type] > 0);

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
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
      {picker ? (
        <ReactionPicker
          mine={summary.mine}
          onReact={onReact}
          disabled={disabled}
          pressedOn={pressedOn}
          onClose={onClose}
        />
      ) : null}
    </div>
  );
}
