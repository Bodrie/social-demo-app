import { UserXIcon } from 'lucide-react';
import { Link, Outlet, useParams } from 'react-router';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile } from '@/features/users/use-users';
import { isApiClientError } from '@/lib/api/client';
import { usePageTitle } from '@/lib/use-page-title';
import type { ProfileContext } from './profile-context';
import { ProfileHeader } from './profile-header';
import { ProfileTabs } from './profile-tabs';

export function ProfilePage() {
  const { username = '' } = useParams();
  const profile = useProfile(username);
  usePageTitle(profile.data ? profile.data.name : `@${username}`);

  if (profile.isPending) return <ProfileSkeleton />;
  if (profile.isError) {
    if (isApiClientError(profile.error) && profile.error.status === 404) {
      return (
        <EmptyState
          icon={UserXIcon}
          title="This profile doesn't exist"
          description={`There is nobody called @${username}.`}
          action={
            <Button asChild variant="outline">
              <Link to="/">Back to home</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ErrorState message="Could not load this profile." onRetry={() => void profile.refetch()} />
    );
  }

  const context: ProfileContext = { user: profile.data };
  // Across a block there is nothing below the header: no posts, no follower lists (ADR 0016).
  const acrossBlock = profile.data.blocked || profile.data.blockedMe;
  return (
    <div className="space-y-4">
      <ProfileHeader user={profile.data} />
      {acrossBlock ? null : (
        <>
          <ProfileTabs />
          <Outlet context={context} />
        </>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="bg-card overflow-hidden rounded-xl border">
        <Skeleton className="aspect-[3/1] max-h-56 w-full rounded-none" />
        <div className="space-y-3 px-5 pb-5">
          <Skeleton className="ring-card -mt-12 size-24 rounded-full ring-4" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-full" />
        </div>
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}
