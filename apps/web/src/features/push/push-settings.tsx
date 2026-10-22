import { DownloadIcon } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth/current-user';
import { Preference } from '@/features/settings/preference';
import { useUpdateSettings } from '@/features/settings/use-settings';
import { useInstallPrompt } from '@/lib/install-prompt';
import { type PushState, usePushDevice, usePushPublicKey } from './use-push';

const DEVICE_TEXT: Record<PushState, string> = {
  checking: 'Checking what this browser can do…',
  unsupported: 'This browser cannot receive push notifications.',
  install:
    'On iPhone and iPad, tap Share and then “Add to Home Screen”, open BeSo from there and switch this on.',
  unavailable: 'Push notifications are not set up on this server yet.',
  blocked:
    'Notifications are blocked for this site. Allow them in your browser’s site settings, then switch this on.',
  off: 'Messages and activity reach this device even while BeSo is closed. Your browser asks for permission once.',
  on: 'Messages and activity reach this device even while BeSo is closed.',
};

/**
 * Settings → Notifications (ADR 0022): push on this device, what it brings (account-wide, for
 * every device that has it on), and installing the app where the browser offers it.
 */
export function PushSettings() {
  const me = useCurrentUser();
  const update = useUpdateSettings();
  const device = usePushDevice();
  const serverHasPush = typeof usePushPublicKey() === 'string';
  const install = useInstallPrompt();
  const deviceId = useId();
  const messagesId = useId();
  const previewsId = useId();
  const socialId = useId();
  const switchable = device.state === 'on' || device.state === 'off';

  return (
    <div className="space-y-5">
      <Preference
        id={deviceId}
        label="Push notifications on this device"
        description={DEVICE_TEXT[device.state]}
        checked={device.state === 'on'}
        disabled={!switchable || device.busy}
        onCheckedChange={(checked) => void (checked ? device.enable() : device.disable())}
      />
      {serverHasPush ? (
        <>
          <Preference
            id={messagesId}
            label="New messages"
            description="A notification for every message someone sends you."
            checked={me.settings.pushMessages}
            onCheckedChange={(checked) => update.mutate({ pushMessages: checked })}
          />
          <Preference
            id={previewsId}
            label="Show what the message says"
            description="Off, a message’s notification only says “New message”."
            checked={me.settings.pushPreviews}
            disabled={!me.settings.pushMessages}
            onCheckedChange={(checked) => update.mutate({ pushPreviews: checked })}
          />
          <Preference
            id={socialId}
            label="Likes, comments, mentions and follows"
            description="What the bell shows: reactions to your posts and comments, replies, mentions, reposts and new followers."
            checked={me.settings.pushSocial}
            onCheckedChange={(checked) => update.mutate({ pushSocial: checked })}
          />
        </>
      ) : null}
      {install.available ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            Install BeSo to open it from your home screen or app list, in a window of its own.
          </p>
          <Button variant="outline" onClick={() => void install.install()}>
            <DownloadIcon /> Install BeSo
          </Button>
        </div>
      ) : null}
    </div>
  );
}
