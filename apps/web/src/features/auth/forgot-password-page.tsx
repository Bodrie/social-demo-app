import { zodResolver } from '@hookform/resolvers/zod';
import { type ForgotPasswordInput, forgotPasswordSchema } from '@the-mesh/shared';
import { Loader2Icon, MailCheckIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { usePageTitle } from '@/lib/use-page-title';
import { AuthLayout } from './auth-layout';
import { applyApiErrors } from './form-errors';
import { useForgotPassword } from './use-auth-mutations';

export function ForgotPasswordPage() {
  usePageTitle('Forgot password');
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = (values: ForgotPasswordInput) => {
    forgot.mutate(values, {
      onSuccess: () => setSentTo(values.email),
      onError: (error) => applyApiErrors(error, form.setError, ['email']),
    });
  };

  const footer = (
    <>
      Remembered it?{' '}
      <Link to="/login" className="text-foreground font-medium underline underline-offset-4">
        Back to sign in
      </Link>
    </>
  );

  // The form that had focus is gone with the submit; the new heading says what happened.
  useEffect(() => {
    if (sentTo) document.getElementById('auth-title')?.focus();
  }, [sentTo]);

  if (sentTo) {
    return (
      <AuthLayout
        title="Check your inbox"
        subtitle="If that address has an account, a link is on its way."
        footer={footer}
      >
        <div className="bg-muted flex items-start gap-3 rounded-lg p-4 text-sm">
          <MailCheckIcon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>
            We sent a password reset link to <strong className="font-semibold">{sentTo}</strong> if
            it belongs to an account. It works for one hour. Check your spam folder too.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Tell us your email and we will send you a link to choose a new one."
      footer={footer}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-11 rounded-lg"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" className="h-11 w-full" disabled={forgot.isPending}>
            {forgot.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
            {forgot.isPending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
