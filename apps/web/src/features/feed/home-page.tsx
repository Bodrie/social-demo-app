import { Suspense, lazy } from 'react';
import { useCurrentUser } from '@/features/auth/current-user';
import { PostComposer } from '@/features/posts/post-composer';
import { usePageTitle } from '@/lib/use-page-title';
import { Feed } from './feed';

// A chunk of its own: the checklist matters to newcomers only and stays off the first paint.
const GettingStartedCard = lazy(async () => ({
  default: (await import('@/features/achievements/getting-started-card')).GettingStartedCard,
}));

export function HomePage() {
  usePageTitle('Home');
  const me = useCurrentUser();
  return (
    <div className="space-y-4">
      <h1 className="sr-only">Home</h1>
      {me.settings.hideGettingStarted ? null : (
        <Suspense fallback={null}>
          <GettingStartedCard />
        </Suspense>
      )}
      <PostComposer />
      <Feed />
    </div>
  );
}
