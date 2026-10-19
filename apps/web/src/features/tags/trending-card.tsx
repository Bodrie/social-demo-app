import { cn } from 'cn';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTrendingTags } from './use-tags';

/** The tags most posted with this week. Renders nothing until there is something to show. */
export function TrendingCard({ className }: { className?: string }) {
  const trending = useTrendingTags(5);
  if (!trending.isSuccess || trending.data.length === 0) return null;

  return (
    <Card className={cn('gap-3 py-4', className)}>
      <CardHeader className="px-4">
        <CardTitle>Trending</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <ul aria-label="Trending tags" className="space-y-2">
          {trending.data.map(({ tag, count }) => (
            <li key={tag} className="flex items-baseline justify-between gap-3">
              <Link
                to={`/tags/${encodeURIComponent(tag)}`}
                className="truncate text-sm font-medium hover:underline"
              >
                #{tag}
              </Link>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {count} {count === 1 ? 'post' : 'posts'}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
