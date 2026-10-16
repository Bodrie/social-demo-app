import { zodResolver } from '@hookform/resolvers/zod';
import { type RegisterInput, registerSchema } from '@the-mesh/shared';
import { Loader2Icon } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
import { AuthLayout } from './auth-layout';
import { applyApiErrors } from './form-errors';
import { useRegister } from './use-auth-mutations';

export function RegisterPage() {
  const register = useRegister();
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', username: '', name: '', password: '' },
  });

  const onSubmit = (values: RegisterInput) => {
    register.mutate(values, {
      onSuccess: () => toast.success('Welcome aboard!'),
      onError: (error) =>
        applyApiErrors(error, form.setError, ['email', 'username', 'name', 'password']),
    });
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="A minute is all it takes."
      footer={
        <>
          Already a member?{' '}
          <Link to="/login" className="text-foreground font-medium underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
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
          <Button type="submit" size="lg" className="h-11 w-full" disabled={register.isPending}>
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
