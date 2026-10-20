import type { UserPublic } from '@beso/shared';
import { BanIcon, FlagIcon, MoreHorizontalIcon, VolumeOffIcon, VolumeXIcon } from 'lucide-react';
import { useRef, useState } from 'react';
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
import { ReportDialog } from './report-dialog';
import { useBlock, useMute, useUnmute } from './use-moderation';

/** Mute, block and report, on someone else's profile (ADR 0016). */
export function ProfileActions({ user }: { user: UserPublic }) {
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reporting, setReporting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const block = useBlock();
  const mute = useMute();
  const unmute = useUnmute();
  const focusTrigger = () => triggerRef.current?.focus();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button ref={triggerRef} variant="outline" size="icon" aria-label="Profile options">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {user.muted ? (
            <DropdownMenuItem onSelect={() => unmute.mutate(user)}>
              <VolumeXIcon /> Unmute @{user.username}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => mute.mutate(user)}>
              <VolumeOffIcon /> Mute @{user.username}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setReporting(true)}>
            <FlagIcon /> Report @{user.username}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmBlock(true)}>
            <BanIcon /> Block @{user.username}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmBlock} onOpenChange={setConfirmBlock}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            focusTrigger();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Block @{user.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will not see each other&apos;s posts, comments or messages, neither of you can
              follow or write to the other, and any follows between you are removed. You can unblock
              them from Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => block.mutate(user)}
            >
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportDialog
        target={{ type: 'user', id: user.id }}
        open={reporting}
        onOpenChange={setReporting}
        returnFocusTo={focusTrigger}
      />
    </>
  );
}
