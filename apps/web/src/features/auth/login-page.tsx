import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginSchema } from '@beso/shared';
import { Loader2Icon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
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
import { Input } from '@/components/ui/input';
import { AuthLayout } from './auth-layout';
import { applyApiErrors } from './form-errors';
import { useLogin } from './use-auth-mutations';

export function LoginPage() {
  const login = useLogin();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // On success the RedirectIfAuthenticated route sends the viewer back where they came from.
  const onSubmit = (values: LoginInput) => {
    login.mutate(values, {
      onError: (error) => applyApiErrors(error, form.setError, ['email', 'password']),
    });
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Pick up where you left off."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="text-foreground font-medium underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
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
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="current-password"
                    className="h-11 rounded-lg pr-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <p className="-mt-2 text-right text-sm">
            <Link
              to="/forgot-password"
              className="text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Forgot your password?
            </Link>
          </p>
          <Button type="submit" size="lg" className="h-11 w-full" disabled={login.isPending}>
            {login.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
