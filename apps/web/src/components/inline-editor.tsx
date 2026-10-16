import { cn } from 'cn';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type InlineEditorProps = {
  initial: string;
  maxLength: number;
  label: string;
  pending?: boolean;
  /** Enter saves (Shift+Enter for a newline); otherwise Ctrl/Cmd+Enter saves. */
  submitOnEnter?: boolean;
  onSave: (content: string) => void;
  onCancel: () => void;
};

/** Edit-in-place for a post or comment: textarea, counter, Save and Cancel, Esc to cancel. */
export function InlineEditor({
  initial,
  maxLength,
  label,
  pending,
  submitOnEnter,
  onSave,
  onCancel,
}: InlineEditorProps) {
  const [content, setContent] = useState(initial);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // The editor replaces the text the reader just chose to edit; focus follows that choice.
  useEffect(() => {
    const element = textareaRef.current;
    element?.focus();
    element?.setSelectionRange(element.value.length, element.value.length);
  }, []);
  const trimmed = content.trim();
  const remaining = maxLength - content.length;
  const canSave = trimmed.length > 0 && remaining >= 0 && trimmed !== initial.trim() && !pending;

  const save = () => {
    if (canSave) onSave(trimmed);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if (
      event.key === 'Enter' &&
      (submitOnEnter ? !event.shiftKey : event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault();
      save();
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        aria-label={label}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={onKeyDown}
        ref={textareaRef}
        rows={2}
        className="min-h-16 text-[15px]/6"
      />
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'text-xs tabular-nums',
            remaining < 0 ? 'text-destructive font-medium' : 'text-muted-foreground',
          )}
        >
          {remaining}
        </span>
        <span className="flex-1" />
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={!canSave}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
