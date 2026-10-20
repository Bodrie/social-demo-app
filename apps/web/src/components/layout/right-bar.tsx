import { ActivitiesCard } from '@/features/activities/activities-card';
import { OnlineCard } from '@/features/chat/online-card';
import { TrendingCard } from '@/features/tags/trending-card';
import { SuggestionsCard } from '@/features/users/suggestions-card';
import { SiteFooter } from './site-footer';

/** Discovery column: people to follow and what followed people are doing. Presence comes from the chat socket. */
export function RightBar() {
  return (
    <aside aria-label="Sidebar" className="flex flex-col gap-4">
      <OnlineCard />
      <SuggestionsCard />
      <TrendingCard />
      <ActivitiesCard />
      <SiteFooter />
    </aside>
  );
}
