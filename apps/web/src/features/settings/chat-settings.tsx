import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCurrentUser } from '@/features/auth/current-user';
import { useUpdateSettings } from './use-settings';

const notificationsSupported = (): boolean => typeof Notification !== 'undefined';

/** The chat preferences (`userSettingsSchema`), each a switch stored on the account. */
export function ChatSettings() {
  const me = useCurrentUser();
  const update = useUpdateSettings();
  const bubblesId = useId();
  const soundId = useId();
  const notificationsId = useId();
  const [asking, setAsking] = useState(false);

  // The browser asks for the permission once, from this switch and nowhere else.
  const toggleNotifications = async (checked: boolean) => {
    if (!checked) {
      update.mutate({ browserNotifications: false });
      return;
    }
    setAsking(true);
    try {
      const permission =
        Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission === 'granted') update.mutate({ browserNotifications: true });
      else toast.error('Notifications are blocked for this site in your browser');
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-5">
      <Preference
        id={bubblesId}
        label="Show chat bubbles for new messages"
        description="A bubble appears in the corner when someone writes to you while you are on another page; open it to reply without leaving. Off, the Messages badge still counts."
        checked={me.settings.chatBubbles}
        onCheckedChange={(checked) => update.mutate({ chatBubbles: checked })}
      />
      <Preference
        id={soundId}
        label="Play a sound for new messages"
        description="A short tone when a message arrives while this tab is in the background."
        checked={me.settings.messageSound}
        onCheckedChange={(checked) => update.mutate({ messageSound: checked })}
      />
      <Preference
        id={notificationsId}
        label="Show browser notifications for new messages"
        description={
          notificationsSupported()
            ? 'A system notification when a message arrives while this tab is in the background. Your browser asks for permission once.'
            : 'Your browser does not support notifications.'
        }
        checked={me.settings.browserNotifications && notificationsSupported()}
        disabled={!notificationsSupported() || asking}
        onCheckedChange={(checked) => void toggleNotifications(checked)}
      />
    </div>
  );
}

type PreferenceProps = {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

function Preference({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: PreferenceProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}
