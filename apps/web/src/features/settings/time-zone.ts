import { isTimeZone, meResponseSchema } from '@beso/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { setMe } from '@/features/auth/use-me';
import { api } from '@/lib/api/client';

/** The device's IANA time zone, or null when the browser does not say or `Intl` refuses it. */
export function deviceTimeZone(): string | null {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone && isTimeZone(zone) ? zone : null;
}

/** Every zone the browser knows, the saved one included even when the list leaves it out. */
export function timeZoneChoices(saved: string | null): string[] {
  const zones =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return saved && !zones.includes(saved) ? [saved, ...zones] : zones;
}

/**
 * Saves the device's time zone for a member who has none yet (F2b): the time-of-day badges and
 * the weekly digest read the clock there. A failure is left for the next start, without a word.
 * Called by the shell; it does nothing once a zone is saved.
 */
export function useTimeZoneSync(saved: string | null): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (saved !== null) return;
    const zone = deviceTimeZone();
    if (!zone) return;
    // The client directly rather than `lib/api/users`: the shell would pull that module onto the
    // first paint and split it from the lazy pages that share it.
    api.patch('/users/me/settings', { timeZone: zone }, { schema: meResponseSchema }).then(
      (me) => setMe(queryClient, me),
      () => undefined,
    );
  }, [saved, queryClient]);
}
