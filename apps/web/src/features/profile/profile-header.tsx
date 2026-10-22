import type { UserPublic } from '@beso/shared';
import dayjs from 'dayjs';
import { CalendarIcon, LinkIcon, MapPinIcon, MessageCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Lightbox } from '@/components/lightbox';
import { UserAvatar } from '@/components/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth/current-user';
import { ProfileActions } from '@/features/moderation/profile-actions';
import { useUnblock } from '@/features/moderation/use-moderation';
import { FollowButton } from '@/features/users/follow-button';
import { displayUrl } from '@/lib/format';
import { EditProfileDialog } from './edit-profile-dialog';
import { InviteButton } from '@/features/invites/invite-button';

export function ProfileHeader({ user }: { user: UserPublic }) {
  const me = useCurrentUser();
  const isMe = user.id === me.id;
  const unblock = useUnblock();
  // Either side of a block gets the reduced profile: who it is, and the way back for the blocker.
  const acrossBlock = user.blocked || user.blockedMe;
  const [viewing, setViewing] = useState<'avatar' | 'cover' | null>(null);
  const viewed = viewing === 'avatar' ? user.avatarUrl : viewing === 'cover' ? user.coverUrl : null;
  const zoomable = 'cursor-zoom-in focus-visible:outline-ring focus-visible:outline-3';

  return (
    <section
      aria-labelledby="profile-name"
      className="bg-card overflow-hidden rounded-xl border shadow-sm"
    >
      <div className="bg-muted relative aspect-[3/1] max-h-56 w-full">
        {user.coverUrl ? (
          <button
            type="button"
            aria-label="Open cover picture"
            aria-haspopup="dialog"
            className={`block size-full focus-visible:-outline-offset-3 ${zoomable}`}
            onClick={() => setViewing('cover')}
          >
            <img src={user.coverUrl} alt="" className="size-full object-cover" />
          </button>
        ) : (
          <div className="from-primary/25 via-primary/10 to-accent size-full bg-linear-to-br" />
        )}
      </div>
      <div className="px-5 pb-5">
        <div className="flex items-end justify-between gap-3">
          {user.avatarUrl ? (
            <button
              type="button"
              aria-label="Open profile picture"
              aria-haspopup="dialog"
              className={`-mt-12 rounded-full focus-visible:outline-offset-2 ${zoomable}`}
              onClick={() => setViewing('avatar')}
            >
              <UserAvatar user={user} size="xl" className="ring-card ring-4" />
            </button>
          ) : (
            <UserAvatar user={user} size="xl" className="ring-card -mt-12 ring-4" />
          )}
          <div className="flex gap-2 pt-3">
            {isMe ? (
              <>
                <EditProfileDialog />
                <InviteButton />
              </>
            ) : user.blocked ? (
              <Button
                variant="outline"
                disabled={unblock.isPending}
                onClick={() => unblock.mutate(user)}
              >
                Unblock
              </Button>
            ) : acrossBlock ? null : (
              <>
                <Button asChild variant="outline">
                  <Link to={`/messages/with/${user.username}`}>
                    <MessageCircleIcon /> Message
                  </Link>
                </Button>
                <FollowButton user={user} />
                <ProfileActions user={user} />
              </>
            )}
          </div>
        </div>

        <div className="mt-3">
          <h1 id="profile-name" className="text-xl leading-tight font-bold">
            {user.name}
          </h1>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-2 text-sm">
            @{user.username}
            {user.followsMe ? <Badge variant="secondary">Follows you</Badge> : null}
            {user.muted ? <Badge variant="outline">Muted</Badge> : null}
          </p>
        </div>

        {acrossBlock ? (
          <p className="text-muted-foreground mt-3 text-sm">
            {user.blocked
              ? 'You blocked this member. Neither of you sees the other’s posts or messages.'
              : 'This profile is not available.'}
          </p>
        ) : null}

        {user.bio ? (
          <p className="mt-3 text-[15px]/6 break-words whitespace-pre-wrap">{user.bio}</p>
        ) : null}

        {acrossBlock ? null : (
          <>
            <ul className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {user.city ? (
                <li className="flex items-center gap-1.5">
                  <MapPinIcon className="size-4" aria-hidden="true" />
                  {user.city}
                </li>
              ) : null}
              {user.website ? (
                <li className="flex items-center gap-1.5">
                  <LinkIcon className="size-4" aria-hidden="true" />
                  <a
                    href={user.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {displayUrl(user.website)}
                  </a>
                </li>
              ) : null}
              <li className="flex items-center gap-1.5">
                <CalendarIcon className="size-4" aria-hidden="true" />
                Joined {dayjs(user.createdAt).format('MMMM YYYY')}
              </li>
            </ul>

            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <div>
                <dt className="sr-only">Posts</dt>
                <dd>
                  <strong className="tabular-nums">{user.counts.posts}</strong>{' '}
                  <span className="text-muted-foreground">Posts</span>
                </dd>
              </div>
              <div>
                <dt className="sr-only">Followers</dt>
                <dd>
                  <Link to="followers" className="hover:underline">
                    <strong className="tabular-nums">{user.counts.followers}</strong>{' '}
                    <span className="text-muted-foreground">Followers</span>
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="sr-only">Following</dt>
                <dd>
                  <Link to="following" className="hover:underline">
                    <strong className="tabular-nums">{user.counts.following}</strong>{' '}
                    <span className="text-muted-foreground">Following</span>
                  </Link>
                </dd>
              </div>
            </dl>
          </>
        )}
      </div>
      <Lightbox
        images={viewed ? [{ url: viewed, width: null, height: null }] : []}
        index={viewed ? 0 : null}
        onIndexChange={(next) => {
          if (next === null) setViewing(null);
        }}
        title={
          viewing === 'cover' ? `Cover picture of ${user.name}` : `Profile picture of ${user.name}`
        }
        alt={user.name}
      />
    </section>
  );
}
