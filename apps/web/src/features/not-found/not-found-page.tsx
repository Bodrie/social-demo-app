import { CompassIcon } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { usePageTitle } from '@/lib/use-page-title';

/** Unknown addresses inside the app keep the shell, so the navigation stays at hand. */
export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <EmptyState
      icon={CompassIcon}
      title="Page not found"
      description="The page you are looking for does not exist or has moved."
      action={
        <Button asChild>
          <Link to="/">Back to home</Link>
        </Button>
      }
    />
  );
}
