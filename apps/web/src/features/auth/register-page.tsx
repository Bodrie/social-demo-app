import { zodResolver } from '@hookform/resolvers/zod';
import { type RegisterInput, type UserSummary, registerSchema } from '@beso/shared';
import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/user-avatar';
import { PicturePicker } from '@/features/profile/picture-picker';
import { isApiClientError } from '@/lib/api/client';
import { getTurnstileSiteKey } from '@/lib/env';
import { AuthLayout } from './auth-layout';
import { applyApiErrors } from './form-errors';
import { Turnstile } from './turnstile';
import { useRegister } from './use-auth-mutations';

/**
 * The join page's invite (F1): `inviter` undefined while it is being looked up, null when the
 * link no longer works (the visitor joins without it).
 */
type RegisterInvite = { code: string; inviter: UserSummary | null | undefined };

export function RegisterPage({ invite }: { invite?: RegisterInvite } = {}) {
  const register = useRegister();
  const inviter = invite?.inviter;
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', username: '', name: '', password: '' },
  });
  const typedName = useWatch({ control: form.control, name: 'name' });
  // The bot check (Cloudflare Turnstile) only where a site key was built in.
  const siteKey = getTurnstileSiteKey();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const waitingForCaptcha = siteKey !== '' && captchaToken === null;

  const onSubmit = (values: RegisterInput) => {
    setCaptchaError(null);
    const withInvite = inviter && invite ? { ...values, inviteCode: invite.code } : values;
    register.mutate(
      siteKey ? { ...withInvite, captchaToken: captchaToken ?? undefined } : withInvite,
      {
        onSuccess: () => toast.success('Welcome aboard!'),
        onError: (error) => {
          if (isApiClientError(error) && error.fields.captchaToken) {
            setCaptchaError(error.fields.captchaToken);
          } else {
            applyApiErrors(error, form.setError, [
              'email',
              'username',
              'name',
              'password',
              'avatarPreset',
            ]);
          }
          // Turnstile tokens work once: whatever went wrong, the next attempt needs a new one.
          if (siteKey) setCaptchaReset((count) => count + 1);
        },
      },
    );
  };

  return (
    <AuthLayout
      title={inviter ? `${inviter.name} invited you to BeSo` : 'Create your account'}
      subtitle={
        inviter
          ? 'Join, and you start out following them. A minute is all it takes.'
          : 'A minute is all it takes.'
      }
      footer={
        <>
          Already a member?{' '}
          <Link to="/login" className="text-foreground font-medium underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      {inviter ? (
        <div className="bg-muted/60 mb-5 flex items-center gap-3 rounded-lg p-3">
          <UserAvatar user={inviter} size="sm" />
          <p className="text-sm">
            <span className="font-medium">{inviter.name}</span>{' '}
            <span className="text-muted-foreground">@{inviter.username}</span>
          </p>
        </div>
      ) : invite && inviter === null ? (
        <p className="bg-muted/60 text-muted-foreground mb-5 rounded-lg p-3 text-sm">
          This invite link does not work any more, but you can still join.
        </p>
      ) : null}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="name"
                      placeholder="Your name"
                      className="h-11 rounded-lg"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="username"
                      placeholder="your_handle"
                      className="h-11 rounded-lg"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
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
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    className="h-11 rounded-lg pr-11"
                    {...field}
                  />
                </FormControl>
                <FormDescription>At least 8 characters.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="avatarPreset"
            render={({ field }) => (
              <FormItem>
                {/* Optional, and the initials until something is picked (ADR 0021, "Rewards"). */}
                <PicturePicker
                  kind="avatar"
                  legend="Pick a picture (optional)"
                  value={field.value ?? null}
                  onChange={(id) => field.onChange(id ?? undefined)}
                  none={{
                    label: 'Your initials',
                    picture: (
                      <UserAvatar
                        user={{ name: typedName.trim() || '?', avatarUrl: null }}
                        className="size-full"
                      />
                    ),
                  }}
                />
                <FormDescription>
                  You can change it, or upload a photo of your own, in your profile later.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {siteKey ? (
            <Turnstile
              siteKey={siteKey}
              onToken={setCaptchaToken}
              resetSignal={captchaReset}
              error={captchaError}
            />
          ) : null}
          <p className="text-muted-foreground text-xs/5">
            By creating an account you agree to the{' '}
            <Link to="/terms" className="text-foreground underline underline-offset-4">
              Terms of use
            </Link>{' '}
            and acknowledge the{' '}
            <Link to="/privacy" className="text-foreground underline underline-offset-4">
              Privacy notice
            </Link>
            .
          </p>
          <Button
            type="submit"
            size="lg"
            className="h-11 w-full"
            disabled={register.isPending || waitingForCaptcha}
          >
            {register.isPending ? (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            ) : null}
            {register.isPending ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
