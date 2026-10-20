/*
 * The ARIA combobox pattern: the textarea owns focus and the keyboard, the list below only
 * mirrors the highlighted option through aria-activedescendant. A <select> cannot do that and
 * key handlers on the options would never fire, hence the two exemptions.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role, jsx-a11y/click-events-have-key-events */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { UserSummary } from '@beso/shared';
import { cn } from 'cn';
import {
  type ChangeEvent,
  type ComponentProps,
  type KeyboardEvent,
  type Ref,
  type SyntheticEvent,
  useCallback,
  useId,
  useRef,
  useState,
} from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { Textarea } from '@/components/ui/textarea';
import { insertText } from '@/features/posts/insert-text';
import { fetchUsers } from '@/lib/api/users';
import { sortMentionMatches } from '@/lib/mention-match';
import { queryKeys } from '@/lib/query-keys';
import { useDebouncedValue } from '@/lib/use-debounced-value';

const SUGGESTION_COUNT = 6;
/** `@` plus what was typed so far, at the caret, after a non-word character or the start. */
const ACTIVE_MENTION = /(?:^|[^\p{L}\p{N}_@#])@([A-Za-z0-9_]{0,30})$/u;

type ActiveMention = { start: number; query: string };

function activeMentionAt(value: string, caret: number): ActiveMention | null {
  const match = ACTIVE_MENTION.exec(value.slice(0, caret));
  if (!match) return null;
  const query = match[1] ?? '';
  return { start: caret - query.length - 1, query };
}

type MentionTextareaProps = Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  ref?: Ref<HTMLTextAreaElement>;
};

/**
 * A textarea that offers members while an `@handle` is being typed. Arrow keys move, Enter or
 * Tab inserts `@username `, Escape closes; the list is a listbox the textarea controls through
 * `aria-activedescendant`, so nothing steals focus from the text.
 */
export function MentionTextarea({
  value,
  onValueChange,
  onKeyDown,
  onSelect,
  onBlur,
  ref,
  className,
  ...props
}: MentionTextareaProps) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const setRefs = useCallback(
    (element: HTMLTextAreaElement | null) => {
      innerRef.current = element;
      if (typeof ref === 'function') ref(element);
      else if (ref) ref.current = element;
    },
    [ref],
  );
  const listboxId = useId();
  const [active, setActive] = useState<ActiveMention | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const query = useDebouncedValue(active?.query ?? '', 150);

  const suggestions = useQuery({
    queryKey: queryKeys.users.mentions(query),
    queryFn: ({ signal }) => fetchUsers({ q: query || undefined, signal }),
    enabled: active !== null,
    select: (data) => data.items.slice(0, SUGGESTION_COUNT) as UserSummary[],
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  // The server answers the debounced query; filtering and ranking with the live one keeps the
  // list consistent with what is typed (and instant) while that answer is on its way.
  const options =
    active && suggestions.data ? sortMentionMatches(suggestions.data, active.query) : [];
  const open = active !== null && options.length > 0;
  const current = options[Math.min(highlighted, options.length - 1)];

  const track = (element: HTMLTextAreaElement, nextValue = element.value) => {
    const next = activeMentionAt(nextValue, element.selectionStart ?? nextValue.length);
    setActive((previous) =>
      previous?.start === next?.start && previous?.query === next?.query ? previous : next,
    );
    if (next?.start !== active?.start) setHighlighted(0);
  };

  const pick = (user: UserSummary) => {
    const element = innerRef.current;
    if (!active) return;
    const caret = element?.selectionStart ?? value.length;
    const next = insertText(value, active.start, caret, `@${user.username} `);
    onValueChange(next.value);
    setActive(null);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(next.caret, next.caret);
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlighted((index) => (index + 1) % options.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlighted((index) => (index - 1 + options.length) % options.length);
        return;
      }
      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        if (current) {
          event.preventDefault();
          pick(current);
          return;
        }
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setActive(null);
        return;
      }
    }
    onKeyDown?.(event);
  };

  return (
    <div className="relative min-w-0 flex-1">
      <Textarea
        {...props}
        ref={setRefs}
        value={value}
        className={className}
        aria-autocomplete="list"
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && current ? `${listboxId}-${current.id}` : undefined}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onValueChange(event.target.value);
          track(event.target, event.target.value);
        }}
        onSelect={(event: SyntheticEvent<HTMLTextAreaElement>) => {
          track(event.currentTarget);
          onSelect?.(event);
        }}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          setActive(null);
          onBlur?.(event);
        }}
      />
      <span className="sr-only" aria-live="polite">
        {open ? `${options.length} member suggestions, use the arrow keys` : ''}
      </span>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Members"
          className="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border p-1 shadow-md"
        >
          {options.map((user) => (
            <div
              key={user.id}
              id={`${listboxId}-${user.id}`}
              role="option"
              aria-selected={current?.id === user.id}
              tabIndex={-1}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                current?.id === user.id && 'bg-accent text-accent-foreground',
              )}
              // The textarea keeps focus: a mousedown would blur it and close the list.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlighted(options.indexOf(user))}
              onClick={() => pick(user)}
            >
              <UserAvatar user={user} className="size-6" />
              <span className="truncate font-medium">{user.name}</span>
              <span className="text-muted-foreground truncate text-xs">@{user.username}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
