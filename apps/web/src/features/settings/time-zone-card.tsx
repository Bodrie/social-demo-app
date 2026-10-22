import { useId, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useCurrentUser } from '@/features/auth/current-user';
import { deviceTimeZone, timeZoneChoices } from './time-zone';
import { useUpdateSettings } from './use-settings';

const NOT_SET = '';

/** "Tuesday 14:05", the wall clock in a zone right now. */
function clockIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

/**
 * Settings → Time zone (F2b): the badges for the time of day read the clock here, as the weekly
 * digest will. Set from the device on the first visit (`TimeZoneSync`), so there is no "none" to
 * choose: it would be taken back at the next start. A native select keeps the long list
 * searchable by typing.
 */
export function TimeZoneCard() {
  const me = useCurrentUser();
  const update = useUpdateSettings();
  const id = useId();
  const saved = me.settings.timeZone;
  const device = deviceTimeZone();
  const choices = useMemo(() => timeZoneChoices(saved), [saved]);

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>Time zone</h2>
        </CardTitle>
        <CardDescription>
          Badges for the time of day, such as Night owl, read the clock here.
          {saved ? ` It is ${clockIn(saved)} there now.` : ' Without one, they stay out of reach.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={id}>Time zone</Label>
          <select
            id={id}
            value={saved ?? NOT_SET}
            disabled={update.isPending}
            onChange={(event) => update.mutate({ timeZone: event.target.value })}
            className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50 md:text-sm"
          >
            {saved === null ? (
              <option value={NOT_SET} disabled>
                Choose your time zone
              </option>
            ) : null}
            {choices.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        {device && device !== saved ? (
          <Button
            variant="outline"
            size="sm"
            disabled={update.isPending}
            onClick={() => update.mutate({ timeZone: device })}
          >
            Use this device’s: {device.replaceAll('_', ' ')}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
