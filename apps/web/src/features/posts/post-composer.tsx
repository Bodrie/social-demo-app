import { POST_MAX_LENGTH, UPLOAD_LIMITS } from '@the-mesh/shared';
import { cn } from 'cn';
import { ImageIcon } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MentionTextarea } from '@/components/mention-textarea';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCurrentUser } from '@/features/auth/current-user';
import { AttachmentPreview } from '@/features/uploads/attachment-preview';
import { useImageUpload } from '@/features/uploads/use-image-upload';
import { isApiClientError } from '@/lib/api/client';
import { firstName } from '@/lib/names';
import { EmojiPickerButton } from './emoji-picker-button';
import { insertText } from './insert-text';
import { useCreatePost } from './use-post-mutations';

const COUNTER_THRESHOLD = 50;

export function PostComposer() {
  const me = useCurrentUser();
  const createPost = useCreatePost();
  const image = useImageUpload('post');
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmed = content.trim();
  const remaining = POST_MAX_LENGTH - content.length;
  const imageBusy = image.state.status === 'uploading' || image.state.status === 'error';
  const canSubmit = trimmed.length > 0 && remaining >= 0 && !imageBusy && !createPost.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    const imageKey = image.state.status === 'ready' ? image.state.upload.key : undefined;
    createPost.mutate(
      { content: trimmed, imageKey },
      {
        onSuccess: () => {
          setContent('');
          image.clear();
          toast.success('Posted');
        },
        onError: (error) =>
          toast.error(isApiClientError(error) ? error.message : 'Could not publish the post'),
      },
    );
  };

  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const problem = image.select(file);
    if (problem) toast.error(problem);
  };

  const insertEmoji = (emoji: string) => {
    const element = textareaRef.current;
    const start = element?.selectionStart ?? content.length;
    const end = element?.selectionEnd ?? content.length;
    const next = insertText(content, start, end, emoji);
    setContent(next.value);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(next.caret, next.caret);
    });
  };

  return (
    <Card className="py-4">
      <form onSubmit={submit}>
        <CardContent className="flex gap-3 px-4">
          <UserAvatar user={me} className="mt-1" />
          <div className="min-w-0 flex-1 space-y-3">
            <MentionTextarea
              ref={textareaRef}
              aria-label="New post"
              placeholder={`What's on your mind, ${firstName(me.name)}?`}
              value={content}
              onValueChange={setContent}
              className="min-h-14 resize-none border-0 bg-transparent px-0 py-2 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
            />

            {image.state.status !== 'idle' ? (
              <AttachmentPreview state={image.state} onRetry={image.retry} onRemove={image.clear} />
            ) : null}

            <div className="flex items-center gap-1 border-t pt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept={UPLOAD_LIMITS.acceptedTypes.join(',')}
                className="sr-only"
                aria-label="Attach an image"
                tabIndex={-1}
                onChange={pickFile}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Add image"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon />
              </Button>
              <EmojiPickerButton onPick={insertEmoji} />
              <span className="flex-1" />
              {remaining <= COUNTER_THRESHOLD ? (
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    remaining < 0 ? 'text-destructive font-medium' : 'text-muted-foreground',
                  )}
                  aria-live="polite"
                >
                  {remaining}
                </span>
              ) : null}
              <Button type="submit" size="sm" disabled={!canSubmit}>
                {createPost.isPending ? 'Posting…' : 'Post'}
              </Button>
            </div>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
