import { ACHIEVEMENT_BY_KEY, GETTING_STARTED_KEYS } from '@beso/shared/achievements';
import { XIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCurrentUser } from '@/features/auth/current-user';
import { useUpdateSettings } from '@/features/settings/use-settings';
import { Medallion } from './medallion';
import { useUserAchievements } from './use-achievements';

type GettingStartedKey = (typeof GETTING_STARTED_KEYS)[number];

/** Where each step is done; the first post is written in the composer right above. */
const WHERE: Record<GettingStartedKey, 'profile' | 'people' | 'explore' | null> = {
  'profile-picture': 'profile',
  'cover-photo': 'profile',
  bio: 'profile',
  'follow-3': 'people',
  'first-post': null,
  'first-comment': 'explore',
};

/**
 * The newcomer's checklist at the top of the home feed (F2): six steps, each a badge, until
 * "All set" is earned or the member hides it (Settings brings it back).
 */
export function GettingStartedCard() {
  const me = useCurrentUser();
  const query = useUserAchievements(me.id);
  const update = useUpdateSettings();
  if (!query.data) return null;
  const earned = new Set(query.data.items.map((item) => item.key));
  if (earned.has('all-set')) return null;
  const done = GETTING_STARTED_KEYS.filter((key) => earned.has(key)).length;
  const links = {
    profile: `/u/${me.username}`,
    people: '/users',
    explore: '/explore',
  } as const;

  return (
    <section aria-labelledby="getting-started-title">
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2 id="getting-started-title">Getting started</h2>
          </CardTitle>
          <CardDescription>
            Six steps to make BeSo yours, each a badge. {done} of {GETTING_STARTED_KEYS.length}{' '}
            done.
          </CardDescription>
          <CardAction>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Hide getting started"
              disabled={update.isPending}
              onClick={() => update.mutate({ hideGettingStarted: true })}
            >
              <XIcon />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {GETTING_STARTED_KEYS.map((key) => {
              const achievement = ACHIEVEMENT_BY_KEY.get(key);
              if (!achievement) return null;
              const isDone = earned.has(key);
              const where = WHERE[key];
              const following =
                key === 'follow-3' && !isDone ? ` (${Math.min(me.counts.following, 3)} of 3)` : '';
              return (
                <li key={key} className="flex items-center gap-3 text-sm">
                  <Medallion achievement={achievement} locked={!isDone} size="sm" />
                  <span className={isDone ? 'text-muted-foreground line-through' : undefined}>
                    {where && !isDone ? (
                      <Link to={links[where]} className="text-primary hover:underline">
                        {achievement.description.replace(/\.$/, '')}
                      </Link>
                    ) : (
                      achievement.description.replace(/\.$/, '')
                    )}
                    {following}
                    {isDone ? <span className="sr-only"> (done)</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
