import {
  POLL_DURATION_LABELS,
  POLL_DURATIONS,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  type PollDuration,
  pollDurationSchema,
} from '@beso/shared';
import { PlusIcon, XIcon } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** What the composer holds until the post goes out; `createPollSchema` checks it then. */
export type PollDraft = { options: string[]; duration: PollDuration };

type PollEditorProps = {
  value: PollDraft;
  onChange: (value: PollDraft) => void;
  onRemove: () => void;
  /** Why the poll cannot go out yet, after a try (the schema's first message). */
  problem: string | null;
};

/**
 * The poll part of the composer (F3): two to four options and how long it stays open. A lazy
 * chunk, loaded when the member presses "Poll"; it takes the focus to its first option.
 */
export function PollEditor({ value, onChange, onRemove, problem }: PollEditorProps) {
  const durationId = useId();
  const problemId = useId();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // Where the focus goes after the options change: a new option, or the one before a removed one.
  const focusNext = useRef<number | null>(0);

  useEffect(() => {
    if (focusNext.current === null) return;
    inputs.current[focusNext.current]?.focus();
    focusNext.current = null;
  });

  const setOption = (index: number, text: string) =>
    onChange({ ...value, options: value.options.map((old, i) => (i === index ? text : old)) });
  const addOption = () => {
    focusNext.current = value.options.length;
    onChange({ ...value, options: [...value.options, ''] });
  };
  const removeOption = (index: number) => {
    focusNext.current = index - 1;
    onChange({ ...value, options: value.options.filter((_, i) => i !== index) });
  };

  return (
    <fieldset className="space-y-2 rounded-lg border p-3">
      <legend className="sr-only">Poll</legend>
      {value.options.map((text, index) => {
        const label = `Option ${index + 1}`;
        const optional = index >= POLL_MIN_OPTIONS;
        return (
          // Options are positions; nothing else identifies them while they are being typed.
          // oxlint-disable-next-line react/no-array-index-key
          <div key={index} className="flex items-center gap-2">
            <Input
              ref={(element) => {
                inputs.current[index] = element;
              }}
              aria-label={label}
              aria-describedby={problem ? problemId : undefined}
              placeholder={optional ? `${label} (optional)` : label}
              value={text}
              maxLength={POLL_OPTION_MAX_LENGTH}
              onChange={(event) => setOption(index, event.target.value)}
            />
            {optional ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove option ${index + 1}`}
                onClick={() => removeOption(index)}
              >
                <XIcon />
              </Button>
            ) : null}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {value.options.length < POLL_MAX_OPTIONS ? (
          <Button type="button" variant="ghost" size="sm" onClick={addOption}>
            <PlusIcon /> Add option
          </Button>
        ) : null}
        <label htmlFor={durationId} className="text-muted-foreground ml-auto text-sm">
          Open for
        </label>
        <select
          id={durationId}
          value={value.duration}
          onChange={(event) =>
            onChange({ ...value, duration: pollDurationSchema.parse(event.target.value) })
          }
          className="border-input bg-background focus-visible:ring-ring/50 h-8 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none dark:bg-input/30"
        >
          {POLL_DURATIONS.map((duration) => (
            <option key={duration} value={duration}>
              {POLL_DURATION_LABELS[duration]}
            </option>
          ))}
        </select>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          Remove poll
        </Button>
      </div>
      <output id={problemId} className="text-destructive block text-xs empty:hidden">
        {problem}
      </output>
    </fieldset>
  );
}
