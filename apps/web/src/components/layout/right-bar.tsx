import { ActivitiesCard } from '@/features/activities/activities-card';
import { SuggestionsCard } from '@/features/users/suggestions-card';

/** Discovery column: people to follow and what followed people are doing. Presence joins in 4f. */
export function RightBar() {
  return (
    <aside aria-label="Sidebar" className="flex flex-col gap-4">
      <SuggestionsCard />
      <ActivitiesCard />
    </aside>
  );
}
