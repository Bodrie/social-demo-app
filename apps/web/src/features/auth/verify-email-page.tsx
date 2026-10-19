import { Loader2Icon, MailCheckIcon, MailWarningIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { SessionError } from '@/components/session-error';
import { isApiClientError } from '@/lib/api/client';
import { usePageTitle } from '@/lib/use-page-title';
import { AuthLayout } from './auth-layout';
import { useLogout, useResendVerification, useVerifyEmail } from './use-auth-mutations';
import { useMe } from './use-me';

/**
 * Two jobs on one address. With `?token=` it is the mailed link: the token is spent at once;
 * a browser that already holds that account's session continues into the app, any other is
 * told the address is confirmed and asked to sign in (the link alone never signs anyone in).
 * Without it, it is the waiting room for a signed-in member whose address is not confirmed
 * yet (the only page open to them).
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  usePageTitle('Confirm your email');
  if (token) return <ConsumeLink token={token} />;
  return <WaitingRoom />;
}

function ConsumeLink({ token }: { token: string }) {
  const verify = useVerifyEmail();
  const navigate = useNavigate();
  const started = useRef<string | null>(null);
  const { mutate } = verify;

  useEffect(() => {
    if (started.current === token) return;
    started.current = token;
    mutate(
      { token },
      {
        onSuccess: ({ user }) => {
          if (user) void navigate('/', { replace: true });
        },
      },
    );
  }, [token, mutate, navigate]);

  if (verify.isSuccess && verify.data.user === null) {
    return (
      <AuthLayout
        title="Email address confirmed"
        subtitle="Sign in to start using your account."
        footer={
          <>
            Forgot your password?{' '}
            <Link
              to="/forgot-password"
              className="text-foreground font-medium underline underline-offset-4"
            >
              Reset it
            </Link>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-muted flex items-start gap-3 rounded-lg p-4 text-sm">
            <MailCheckIcon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>
              This browser is not signed in to that account, so the link only confirmed the address.
              Sign in with your email and password to continue.
            </p>
          </div>
          <Button asChild size="lg" className="h-11 w-full">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (verify.isError) {
    const message = isApiClientError(verify.error)
      ? verify.error.message
      : 'Could not confirm your email address.';
    return (
      <AuthLayout
        title="This link did not work"
        subtitle={message}
        footer={
          <>
            Signed in already?{' '}
            <Link
              to="/verify-email"
              className="text-foreground font-medium underline underline-offset-4"
            >
              Ask for a new link
            </Link>
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
              Links work once and for a limited time. Sign in and we will send you a fresh one; if
              your address is already confirmed, just sign in.
            </p>
          </div>
          <Button asChild size="lg" className="h-11 w-full">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }
  return <FullPageSpinner label="Confirming your email address" />;
}

function WaitingRoom() {
  const me = useMe();
  const resend = useResendVerification();
  const logout = useLogout();

  if (me.status === 'loading') return <FullPageSpinner label="Checking your session" />;
  if (me.status === 'error') return <SessionError retry={me.retry} />;
  if (me.status === 'anonymous') return <Navigate to="/login" replace />;
  if (me.user.emailVerifiedAt !== null) return <Navigate to="/" replace />;

  const sendAgain = () =>
    resend.mutate(undefined, {
      onSuccess: () => toast.success('Sent. Give it a minute and check your spam folder too.'),
      onError: (error) =>
        toast.error(
          isApiClientError(error) && error.status === 429
            ? 'You asked a few times already. Wait a while before trying again.'
            : 'Could not send the email right now. Please try again.',
        ),
    });

  return (
    <AuthLayout
      title="Check your inbox"
      subtitle="One more step before you can get in."
      footer={
        <>
          Wrong address?{' '}
          <button
            type="button"
            className="text-foreground font-medium underline underline-offset-4"
            onClick={() => logout.mutate()}
          >
            Sign out
          </button>{' '}
          and register again.
        </>
      }
    >
      <div className="space-y-5">
        <div className="bg-muted flex items-start gap-3 rounded-lg p-4 text-sm">
          <MailCheckIcon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>
            We sent a confirmation link to{' '}
            <strong className="font-semibold">{me.user.email}</strong>. Open it to finish setting up
            your account. The link works for 24 hours.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-11 w-full"
          disabled={resend.isPending}
          onClick={sendAgain}
        >
          {resend.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
          {resend.isPending ? 'Sending…' : 'Send the email again'}
        </Button>
      </div>
    </AuthLayout>
  );
}
