import { POST_MAX_LENGTH, type Post } from '@beso/shared';
import { cn } from 'cn';
import { Repeat2Icon } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { CharacterCounter } from '@/components/character-counter';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/current-user';
import { QuotedPostCard } from './quoted-post-card';
import { useCreatePost, useToggleRepost } from './use-post-mutations';

/**
 * One control, two outcomes (ADR 0017): the popover offers an optional text; without it the
 * button is a plain repost (or its undo), with it a quote post of the viewer's own. On the
 * viewer's own posts only the count shows, since one cannot repost oneself.
 */
export function RepostControl({ post }: { post: Post }) {
  const me = useCurrentUser();
  const toggle = useToggleRepost();
  const create = useCreatePost();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const textareaId = useId();
  const quoting = text.trim().length > 0;

  if (post.author.id === me.id) {
    return (
      <span className="text-muted-foreground inline-flex h-8 items-center gap-1.5 px-3 text-sm font-medium">
        <Repeat2Icon className="size-4" aria-hidden="true" />
        <span className="sr-only">Reposts</span>{' '}
        <span className="tabular-nums">{post.repostCount}</span>
      </span>
    );
  }

  const close = () => {
    setOpen(false);
    setText('');
  };
  const submit = () => {
    if (quoting) {
      create.mutate(
        { content: text.trim(), quotedPostId: post.id },
        {
          onSuccess: () => {
            close();
            toast.success('Quote posted');
          },
          onError: () => toast.error('Could not post the quote'),
        },
      );
      return;
    }
    toggle.mutate({ postId: post.id, reposted: post.repostedByMe });
    close();
  };

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('gap-1.5', post.repostedByMe && 'text-primary hover:text-primary')}
        >
          <Repeat2Icon />
          <span className="sr-only">Repost</span>{' '}
          <span className="tabular-nums">{post.repostCount}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={textareaId}>Add your thoughts (optional)</Label>
          <Textarea
            id={textareaId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={POST_MAX_LENGTH}
            rows={3}
            placeholder="Leave empty to repost as is"
          />
          <CharacterCounter remaining={POST_MAX_LENGTH - text.length} />
        </div>
        <QuotedPostCard
          compact
          embed={{
            id: post.id,
            author: post.author,
            content: post.content,
            imageUrl: post.imageUrl,
            createdAt: post.createdAt,
          }}
        />
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={submit} disabled={create.isPending}>
            {quoting ? 'Quote' : post.repostedByMe ? 'Undo repost' : 'Repost'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
