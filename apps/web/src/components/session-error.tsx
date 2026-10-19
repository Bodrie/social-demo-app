import { ErrorState } from '@/components/empty-state';

/** The session could not be checked: the API is unreachable or answered with an error (review L8). */
export function SessionError({ retry }: { retry: () => void }) {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <ErrorState
        message="We could not check your session. The server may be restarting; try again in a moment."
        onRetry={retry}
        className="w-full max-w-md"
      />
    </main>
  );
}
