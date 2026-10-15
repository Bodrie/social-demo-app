import { cn } from 'cn';
import { Link } from 'react-router';
import { UserAvatar } from '@/components/user-avatar';
import { UserLink } from '@/components/user-link';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FollowButton } from './follow-button';
import { useSuggestions } from './use-users';

/** People the viewer neither follows nor is followed by; following one keeps the row until the next load. */
export function SuggestionsCard({ className }: { className?: string }) {
  const suggestions = useSuggestions(5);

  return (
    <Card className={cn('gap-3 py-4', className)}>
      <CardHeader className="px-4">
        <CardTitle>Suggestions for you</CardTitle>
        <CardAction>
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link to="/users">See all</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-4">
        {suggestions.isPending ? (
          <ul className="space-y-3" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <li key={index} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-8 w-16" />
              </li>
            ))}
          </ul>
        ) : suggestions.isError ? (
          <p className="text-muted-foreground text-sm">Could not load suggestions.</p>
        ) : suggestions.data.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No suggestions right now. Check back later.
          </p>
        ) : (
          <ul aria-label="Suggestions" className="space-y-3">
            {suggestions.data.map((user) => (
              <li key={user.id} className="flex items-center gap-3">
                <Link to={`/u/${user.username}`} aria-hidden="true" tabIndex={-1}>
                  <UserAvatar user={user} size="lg" />
                </Link>
                <div className="min-w-0 flex-1">
                  <UserLink user={user} className="block truncate text-sm" />
                  <p className="text-muted-foreground truncate text-xs">@{user.username}</p>
                </div>
                <FollowButton user={user} size="sm" className="shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
