import {
  REPORT_DETAILS_MAX_LENGTH,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
  type ReportTargetType,
} from '@beso/shared';
import { useId, useState } from 'react';
import { CharacterCounter } from '@/components/character-counter';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useReport } from './use-moderation';

type ReportDialogProps = {
  target: { type: ReportTargetType; id: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes when the dialog closes (it is opened from a menu item, which is gone by then). */
  returnFocusTo?: () => void;
};

const TITLES: Record<ReportTargetType, string> = {
  post: 'Report this post',
  comment: 'Report this comment',
  user: 'Report this member',
};

/** The reason is required, the details are not; one open report per member and target. */
export function ReportDialog({ target, open, onOpenChange, returnFocusTo }: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const report = useReport();
  const groupId = useId();
  const detailsId = useId();

  const close = () => {
    onOpenChange(false);
    setReason(null);
    setDetails('');
  };
  const submit = () => {
    if (!reason) return;
    report.mutate(
      { targetType: target.type, targetId: target.id, reason, details: details || undefined },
      { onSettled: close },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          if (!returnFocusTo) return;
          event.preventDefault();
          returnFocusTo();
        }}
      >
        <DialogHeader>
          <DialogTitle>{TITLES[target.type]}</DialogTitle>
          <DialogDescription>
            Tell us what is wrong. Reports are read by the people who run this site and are never
            shown to the member you report.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend id={groupId} className="text-sm font-medium">
            Reason
          </legend>
          {REPORT_REASONS.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${groupId}-reason`}
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="accent-primary size-4"
              />
              {REPORT_REASON_LABELS[value]}
            </label>
          ))}
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor={detailsId}>Details (optional)</Label>
          <Textarea
            id={detailsId}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={REPORT_DETAILS_MAX_LENGTH}
            rows={3}
            placeholder="Anything that helps us understand"
          />
          <CharacterCounter remaining={REPORT_DETAILS_MAX_LENGTH - details.length} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!reason || report.isPending}>
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
