import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCurrentUser } from '@/features/auth/current-user';
import { useUpdateSettings } from './use-settings';

/** The chat preferences (`userSettingsSchema`), each a switch stored on the account. */
export function ChatSettings() {
  const me = useCurrentUser();
  const update = useUpdateSettings();
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor={id}>Show chat bubbles for new messages</Label>
        <p className="text-muted-foreground text-sm">
          A bubble appears in the corner when someone writes to you while you are on another page;
          open it to reply without leaving. Off, the Messages badge still counts.
        </p>
      </div>
      <Switch
        id={id}
        checked={me.settings.chatBubbles}
        onCheckedChange={(checked) => update.mutate({ chatBubbles: checked })}
      />
    </div>
  );
}
