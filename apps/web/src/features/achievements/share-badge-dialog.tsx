import { POST_MAX_LENGTH } from '@beso/shared';
import {
  ACHIEVEMENT_BY_KEY,
  type AchievementDefinition,
  achievementName,
} from '@beso/shared/achievements';
import { useId, useState } from 'react';
import { toast } from 'sonner';
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
import { useCreatePost } from '@/features/posts/use-post-mutations';
import { isApiClientError } from '@/lib/api/client';
import { BadgeCard } from './badge-card';

type ShareBadgeDialogProps = { achievementKey: string | null; onClose: () => void };

/** "Share" on a badge (ADR 0021, "Rewards"): a post of its own with the badge as a card. */
export function ShareBadgeDialog({ achievementKey, onClose }: ShareBadgeDialogProps) {
  const achievement = achievementKey ? ACHIEVEMENT_BY_KEY.get(achievementKey) : undefined;
  return (
    <Dialog open={achievement !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share a badge</DialogTitle>
          <DialogDescription>
            A post with the badge goes to your profile and your followers&apos; feeds.
          </DialogDescription>
        </DialogHeader>
        {achievement ? (
          // Keyed: another badge starts from its own words.
          <ShareForm key={achievement.key} achievement={achievement} onDone={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ShareForm({
  achievement,
  onDone,
}: {
  achievement: AchievementDefinition;
  onDone: () => void;
}) {
  const create = useCreatePost();
  const textId = useId();
  const [text, setText] = useState(`I earned “${achievementName(achievement)}” on BeSo.`);

  const share = () => {
    if (!text.trim()) return;
    create.mutate(
      { content: text.trim(), achievementKey: achievement.key },
      {
        onSuccess: () => {
          toast.success('Shared to your followers');
          onDone();
        },
        onError: (error) =>
          toast.error(isApiClientError(error) ? error.message : 'Could not share the badge'),
      },
    );
  };

  return (
    <>
      <BadgeCard achievement={achievement} />
      <div className="space-y-1.5">
        <Label htmlFor={textId}>Your words</Label>
        <Textarea
          id={textId}
          value={text}
          maxLength={POST_MAX_LENGTH}
          rows={3}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <DialogFooter>
        <Button type="button" disabled={!text.trim() || create.isPending} onClick={share}>
          {create.isPending ? 'Sharing…' : 'Share'}
        </Button>
      </DialogFooter>
    </>
  );
}
