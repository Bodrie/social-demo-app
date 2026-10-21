import { REACTIONS, type ReactionSummary, type ReactionType } from '@beso/shared';
import { cn } from 'cn';
import { SmilePlusIcon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** An entry of the press-and-hold surface, under the emojis: what the hover menu offers on desktop. */
export type PressAction = {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onSelect: () => void;
};

type PressProps = {
  /**
   * A press-and-hold on the bubble (`LongPressArea`): while set, the picker is open and sits
   * over that element instead of under its button.
   */
  pressedOn?: HTMLElement | null;
  /** The picker closed (a pick, Escape, a tap outside): the parent clears `pressedOn`. */
  onClose?: () => void;
  /**
   * Shown under the emojis when opened by a press. Touch screens have no hover toolbar and no
   * menu button, so this is where edit, delete and report live there.
   */
  actions?: PressAction[];
};

type ReactionPickerProps = PressProps & {
  mine: ReactionType | null;
  onReact: (type: ReactionType | null) => void;
  disabled?: boolean;
  align?: 'start' | 'end';
  className?: string;
};

/**
 * The "Add reaction" button with its popover of emojis; picking yours again removes it. The
 * button exists for fine pointers only (callers reveal it on hover); on a touch screen the
 * popover opens over the pressed element instead, with the `actions` under the emojis.
 */
export function ReactionPicker({
  mine,
  onReact,
  disabled,
  align = 'start',
  className,
  pressedOn = null,
  onClose,
  actions,
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
          className={cn(
            'text-muted-foreground hover:text-foreground pointer-coarse:hidden rounded-full',
            className,
          )}
          disabled={disabled}
        >
          <SmilePlusIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={anchor ? 'center' : align}
        side={anchor ? 'top' : 'bottom'}
        collisionPadding={8}
        className="w-auto p-1"
        // Opened by a finger: focus wandering (a browser replaying the release as mouse
        // events) must not close it; a tap outside or Escape still does.
        onFocusOutside={anchor ? (event) => event.preventDefault() : undefined}
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
        {anchor && actions && actions.length > 0 ? (
          <div className="mt-1 flex flex-col border-t pt-1">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={cn(
                  'hover:bg-muted flex items-center gap-2 rounded-md px-2 py-2 text-sm [&_svg]:size-4',
                  action.destructive && 'text-destructive',
                )}
                onClick={() => {
                  change(false);
                  action.onSelect();
                }}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
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
  /** For the picker's button (hover reveal on fine pointers; it is gone on coarse ones). */
  pickerClassName?: string;
};

/** Pills for the reactions a comment or message has, plus a picker for adding or changing yours. */
export function ReactionBar({
  summary,
  onReact,
  disabled,
  picker = true,
  className,
  pickerClassName,
  pressedOn,
  onClose,
  actions,
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
          className={pickerClassName}
          pressedOn={pressedOn}
          onClose={onClose}
          actions={actions}
        />
      ) : null}
    </div>
  );
}
