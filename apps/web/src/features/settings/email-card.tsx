import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MailCheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/features/auth/current-user';
import { setMe } from '@/features/auth/use-me';
import { isApiClientError } from '@/lib/api/client';
import { cancelEmailChange, resendEmailChange } from '@/lib/api/account';
import { EmailChangeForm } from './email-change-form';

/** Settings → Email: the current address, and the way to another one (ADR 0010 amendment). */
export function EmailCard() {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const resend = useMutation({
    mutationFn: resendEmailChange,
    onSuccess: () => toast.success('Sent again. Check the spam folder too.'),
    onError: (error) =>
      toast.error(
        isApiClientError(error) && error.status === 429
          ? 'You asked a few times already. Wait a while before trying again.'
          : 'Could not send the email right now.',
      ),
  });
  const cancel = useMutation({
    mutationFn: cancelEmailChange,
    onSuccess: ({ user }) => {
      setMe(queryClient, { user });
      toast.success('Change cancelled');
    },
    onError: () => toast.error('Could not cancel the change'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>Email</h2>
        </CardTitle>
        <CardDescription>
          Where we write to you, and what you sign in with. Only you can see it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Your address is <strong className="font-semibold">{me.email}</strong>.
        </p>
        {me.pendingEmail ? (
          <div className="bg-muted space-y-3 rounded-lg p-4 text-sm">
            <div className="flex items-start gap-3">
              <MailCheckIcon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p>
                Waiting for confirmation: we sent a link to{' '}
                <strong className="font-semibold">{me.pendingEmail}</strong>. Open it and that
                becomes your address. The link works for 24 hours.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resend.isPending}
                onClick={() => resend.mutate()}
              >
                Send the email again
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                Cancel the change
              </Button>
            </div>
          </div>
        ) : (
          <EmailChangeForm />
        )}
      </CardContent>
    </Card>
  );
}
