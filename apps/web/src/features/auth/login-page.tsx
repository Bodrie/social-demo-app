import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginSchema } from '@the-mesh/shared';
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
      aside={
        <>
          <p>A small social network: share posts, follow people, chat when they are online.</p>
          <p>
            New here?{' '}
            <Link to="/register" className="font-semibold underline underline-offset-4">
              Create an account
            </Link>
          </p>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-muted-foreground text-center text-sm md:hidden">
            New here?{' '}
            <Link
              to="/register"
              className="text-foreground font-medium underline underline-offset-4"
            >
              Create an account
            </Link>
          </p>
        </form>
      </Form>
    </AuthLayout>
  );
}
