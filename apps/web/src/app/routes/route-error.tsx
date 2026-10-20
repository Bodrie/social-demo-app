import { useEffect } from 'react';
import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { isStaleChunkError, reloadForNewVersion } from '@/lib/new-version';

/** Catches render/loader errors and unknown routes; keeps the user inside the app. */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  // A lazy page of the build this tab started with is gone after a deploy: load the new build.
  const stale = !notFound && isStaleChunkError(error);
  useEffect(() => {
    if (stale) reloadForNewVersion();
  }, [stale]);

  const title = notFound
    ? 'Page not found'
    : stale
      ? 'A new version is available'
      : 'Something went wrong';
  const description = notFound
    ? 'The page you are looking for does not exist.'
    : stale
      ? 'The app was updated while this page was open. Reload to continue.'
      : 'An unexpected error occurred. Reloading usually helps; if not, please try again later.';

  return (
    <div
      role="alert"
      className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground max-w-md text-sm">{description}</p>
      {stale ? (
        <Button type="button" onClick={() => window.location.reload()}>
          Reload
        </Button>
      ) : (
        <Button asChild>
          <Link to="/">Back to home</Link>
        </Button>
      )}
    </div>
  );
}
