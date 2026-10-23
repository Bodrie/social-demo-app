import type { Post } from '@beso/shared';
import { SendIcon } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { Button } from '@/components/ui/button';

const SendPostDialog = lazy(async () => ({
  default: (await import('@/features/chat/send-post-dialog')).SendPostDialog,
}));

/**
 * "Send post" in a card's footer (ADR 0009 amendment 4). The dialog is a chunk of its own,
 * loaded on the first press and kept afterwards, so closing it animates and hands focus back.
 */
export function SendPostButton({ post }: { post: Post }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Send post"
        aria-haspopup="dialog"
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
      >
        <SendIcon />
      </Button>
      {loaded ? (
        <Suspense fallback={null}>
          <SendPostDialog post={post} open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </>
  );
}
