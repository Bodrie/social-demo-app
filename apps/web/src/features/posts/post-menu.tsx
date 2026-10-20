import type { Post } from '@beso/shared';
import { FlagIcon, LinkIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { type RefObject, Suspense, lazy, useState } from 'react';
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

// Reporting is rare: the dialog loads when it is first opened, not with the feed's first paint.
const ReportDialog = lazy(() =>
  import('@/features/moderation/report-dialog').then((module) => ({
    default: module.ReportDialog,
  })),
);

const postUrl = (postId: string): string => `${window.location.origin}/p/${postId}`;

type PostMenuProps = {
  post: Post;
  isAuthor: boolean;
  onEdit: () => void;
  /** The options button, so focus can come back to it after the editor or the dialog. */
  triggerRef?: RefObject<HTMLButtonElement | null>;
};

/** Copy link for everyone; edit and delete for the author, report for everyone else. */
export function PostMenu({ post, isAuthor, onEdit, triggerRef }: PostMenuProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
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
          ) : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setReporting(true)}>
                <FlagIcon /> Report post
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {reporting ? (
        <Suspense fallback={null}>
          <ReportDialog
            target={{ type: 'post', id: post.id }}
            open={reporting}
            onOpenChange={setReporting}
            returnFocusTo={() => triggerRef?.current?.focus()}
          />
        </Suspense>
      ) : null}

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
