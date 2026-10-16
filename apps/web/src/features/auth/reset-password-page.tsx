import { zodResolver } from '@hookform/resolvers/zod';
import { type ResetPasswordFormInput, resetPasswordFormSchema } from '@the-mesh/shared';
import { Loader2Icon, MailWarningIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { isApiClientError } from '@/lib/api/client';
import { usePageTitle } from '@/lib/use-page-title';
import { AuthLayout } from './auth-layout';
import { applyApiErrors } from './form-errors';
import { useResetPassword } from './use-auth-mutations';

const footer = (
  <>
    Changed your mind?{' '}
    <Link to="/login" className="text-foreground font-medium underline underline-offset-4">
      Back to sign in
    </Link>
  </>
);

/** The mailed reset link: new password twice, then straight into the app. */
export function ResetPasswordPage() {
  usePageTitle('Choose a new password');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const reset = useResetPassword();
  const [linkError, setLinkError] = useState<string | null>(
    token ? null : 'This link is incomplete.',
  );
  const form = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { token, newPassword: '', confirmPassword: '' },
  });

  const onSubmit = (values: ResetPasswordFormInput) => {
    reset.mutate(
      { token: values.token, newPassword: values.newPassword },
      {
        onSuccess: () => void navigate('/', { replace: true }),
        onError: (error) => {
          if (isApiClientError(error) && error.fields.token) setLinkError(error.fields.token);
          else applyApiErrors(error, form.setError, ['newPassword']);
        },
      },
    );
  };

  if (linkError) {
    return (
      <AuthLayout title="This link did not work" subtitle={linkError} footer={footer}>
        <div className="space-y-4">
          <div className="bg-muted text-muted-foreground flex items-start gap-3 rounded-lg p-4 text-sm">
            <MailWarningIcon
              className="text-foreground mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <p>
              Reset links work once and for one hour. Ask for a new one and use the latest email.
            </p>
          </div>
          <Button asChild size="lg" className="h-11 w-full">
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Every other device will be signed out."
      footer={footer}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    className="h-11 rounded-lg pr-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    className="h-11 rounded-lg pr-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" className="h-11 w-full" disabled={reset.isPending}>
            {reset.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
            {reset.isPending ? 'Saving…' : 'Save new password'}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
