import { CopyIcon, RefreshCwIcon, Share2Icon } from 'lucide-react';
import { useId } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMyInvite, useRenewInvite } from './use-invites';

type InviteDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * The member's personal invite link (F1): whoever joins through it follows them once their
 * address is confirmed. Copy, share through the system sheet, or replace it.
 */
export function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const invite = useMyInvite(open);
  const renew = useRenewInvite();
  const linkId = useId();
  const url = invite.data?.url;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link; select it and copy it yourself');
    }
  };

  const share = async () => {
    if (!url) return;
    try {
      await navigator.share({ title: 'Join me on BeSo', text: 'Join me on BeSo', url });
    } catch {
      // Closing the share sheet without choosing is not an error worth a toast.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite friends</DialogTitle>
          <DialogDescription>
            Send this link to people you know. When they join with it, they start out following you,
            and you hear about it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={linkId}>Your invite link</Label>
          {/* Always the field, so the label has its control while the link loads. */}
          <Input
            id={linkId}
            readOnly
            value={url ?? ''}
            placeholder={invite.isError ? 'Could not load your link' : 'Loading…'}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!url} onClick={() => void copy()}>
            <CopyIcon /> Copy link
          </Button>
          {canShare() ? (
            <Button variant="outline" disabled={!url} onClick={() => void share()}>
              <Share2Icon /> Share
            </Button>
          ) : null}
          <Button
            variant="ghost"
            disabled={!url || renew.isPending}
            onClick={() =>
              renew.mutate(undefined, {
                onSuccess: () => toast.success('New link ready; the old one no longer works'),
                onError: () => toast.error('Could not make a new link'),
              })
            }
          >
            <RefreshCwIcon /> Get a new link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
