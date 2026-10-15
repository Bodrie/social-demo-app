import { MESSAGE_MAX_LENGTH } from '@the-mesh/shared';
import { cn } from 'cn';
import { SendIcon } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmojiPickerButton } from '@/features/posts/emoji-picker-button';
import { insertText } from '@/features/posts/insert-text';

type MessageComposerProps = {
  peerName: string;
  disabled?: boolean;
  onSend: (content: string) => void;
};

export function MessageComposer({ peerName, disabled, onSend }: MessageComposerProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = content.trim();
  const remaining = MESSAGE_MAX_LENGTH - content.length;
  const canSend = trimmed.length > 0 && remaining >= 0 && !disabled;

  const send = () => {
    if (!canSend) return;
    onSend(trimmed);
    setContent('');
    textareaRef.current?.focus();
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const insertEmoji = (emoji: string) => {
    const element = textareaRef.current;
    const next = insertText(
      content,
      element?.selectionStart ?? content.length,
      element?.selectionEnd ?? content.length,
      emoji,
    );
    setContent(next.value);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(next.caret, next.caret);
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2 border-t p-3">
      <EmojiPickerButton onPick={insertEmoji} />
      <Textarea
        ref={textareaRef}
        aria-label={`Message ${peerName}`}
        placeholder="Write a message…"
        rows={1}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={onKeyDown}
        className="max-h-40 min-h-9 flex-1 resize-none py-1.5 text-sm"
      />
      {remaining <= 100 ? (
        <span
          className={cn(
            'pb-2 text-xs tabular-nums',
            remaining < 0 ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {remaining}
        </span>
      ) : null}
      <Button type="submit" size="icon-sm" aria-label="Send" disabled={!canSend}>
        <SendIcon />
      </Button>
    </form>
  );
}
