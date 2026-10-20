import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MailCheckIcon, MailWarningIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { Button } from '@/components/ui/button';
import { confirmEmailChange } from '@/lib/api/account';
import { isApiClientError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query-keys';
import { usePageTitle } from '@/lib/use-page-title';
import { AuthLayout } from './auth-layout';

/**
 * The link mailed to a new address (ADR 0010 amendment): the token is spent at once and the
 * account answers to that address from now on. Works signed in or not and signs nobody in;
 * a browser that holds the session just sees its profile refresh.
 */
export function ConfirmEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  usePageTitle('Confirm your new email');
  if (!token) return <Navigate to="/" replace />;
  return <ConsumeLink token={token} />;
}

function ConsumeLink({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const confirm = useMutation({
    mutationFn: confirmEmailChange,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  });
  const started = useRef<string | null>(null);
  const { mutate } = confirm;
  useEffect(() => {
    if (started.current === token) return;
    started.current = token;
    mutate({ token });
  }, [token, mutate]);

  if (confirm.isSuccess) {
    return (
      <AuthLayout
        title="Email address changed"
        subtitle={`Your account now uses ${confirm.data.email}.`}
        footer={
          <>
            Not you?{' '}
            <Link
              to="/forgot-password"
              className="text-foreground font-medium underline underline-offset-4"
            >
              Reset the password
            </Link>{' '}
            from the new address.
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-muted flex items-start gap-3 rounded-lg p-4 text-sm">
            <MailCheckIcon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>
              Sign in with the new address from now on. We let the old address know, in case it was
              not you.
            </p>
          </div>
          <Button asChild size="lg" className="h-11 w-full">
            <Link to="/">Continue</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (confirm.isError) {
    const message = isApiClientError(confirm.error)
      ? confirm.error.message
      : 'Could not confirm the new address.';
    return (
      <AuthLayout
        title="This link did not work"
        subtitle={message}
        footer={
          <>
            Ask for a new one from{' '}
            <Link
              to="/settings"
              className="text-foreground font-medium underline underline-offset-4"
            >
              Settings → Email
            </Link>
            .
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-muted text-muted-foreground flex items-start gap-3 rounded-lg p-4 text-sm">
            <MailWarningIcon
              className="text-foreground mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <p>
              Links work once and for a limited time, and a change that was cancelled or whose
              address has been taken meanwhile cannot be confirmed any more.
            </p>
          </div>
          <Button asChild size="lg" className="h-11 w-full">
            <Link to="/">Go to the app</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }
  return <FullPageSpinner label="Confirming your new email address" />;
}
