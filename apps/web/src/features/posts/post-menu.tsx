import type { Post } from '@the-mesh/shared';
import { LinkIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { type RefObject, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeletePost } from './use-post-mutations';

const postUrl = (postId: string): string => `${window.location.origin}/p/${postId}`;

type PostMenuProps = {
  post: Post;
  isAuthor: boolean;
  onEdit: () => void;
  /** The options button, so focus can come back to it after the editor or the dialog. */
  triggerRef?: RefObject<HTMLButtonElement | null>;
};

/** Copy link for everyone; edit and delete for the author. */
export function PostMenu({ post, isAuthor, onEdit, triggerRef }: PostMenuProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const remove = useDeletePost();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl(post.id));
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button ref={triggerRef} variant="ghost" size="icon-sm" aria-label="Post options">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void copyLink()}>
            <LinkIcon /> Copy link
          </DropdownMenuItem>
          {isAuthor ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onEdit}>
                <PencilIcon /> Edit post
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                <Trash2Icon /> Delete post
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        {/* Opened from a menu item, so Radix has no trigger to return focus to. */}
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef?.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              The post, its image and all of its comments will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => remove.mutate(post.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
