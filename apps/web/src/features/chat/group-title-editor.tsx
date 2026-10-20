import { GROUP_TITLE_MAX_LENGTH } from '@beso/shared';
import type { Conversation } from '@beso/shared';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isApiClientError } from '@/lib/api/client';
import { useRenameGroup } from './use-conversations';

type GroupTitleEditorProps = {
  conversation: Conversation;
  /** Closes the editor, after a save or on Cancel/Escape. */
  onDone: () => void;
  className?: string;
};

/** Rename a group in place (admins only; the server checks). Enter saves, Escape cancels. */
export function GroupTitleEditor({ conversation, onDone, className }: GroupTitleEditorProps) {
  const rename = useRenameGroup(conversation.id);
  const [title, setTitle] = useState(conversation.title ?? '');
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // The field replaces the title the admin just chose to edit; focus follows that choice.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && trimmed !== conversation.title && !rename.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    rename.mutate(
      { title: trimmed },
      {
        onSuccess: onDone,
        onError: (failure) => {
          const message = isApiClientError(failure)
            ? (failure.fields.title ?? failure.message)
            : 'Could not rename the group';
          if (isApiClientError(failure) && failure.fields.title) setError(message);
          else toast.error(message);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex items-center gap-2">
        <Input
          aria-label="Group name"
          aria-invalid={error !== null || undefined}
          aria-describedby={error ? errorId : undefined}
          value={title}
          maxLength={GROUP_TITLE_MAX_LENGTH}
          autoComplete="off"
          ref={inputRef}
          onChange={(event) => {
            setTitle(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onDone();
            }
          }}
          className="h-8"
        />
        <Button type="submit" size="sm" disabled={!canSave}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {error ? (
        <p id={errorId} className="text-destructive mt-1 text-xs">
          {error}
        </p>
      ) : null}
    </form>
  );
}
