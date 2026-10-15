import { zodResolver } from '@hookform/resolvers/zod';
import { type RegisterInput, registerSchema } from '@the-mesh/shared';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
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
      aside={
        <>
          <p>Pick a username, tell people your name, and start following the ones you like.</p>
          <p>
            Already a member?{' '}
            <Link to="/login" className="font-semibold underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input autoComplete="username" placeholder="your_handle" {...field} />
                </FormControl>
                <FormDescription>Lowercase letters, digits and underscores.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" placeholder="Your name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormDescription>At least 8 characters.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={register.isPending}>
            {register.isPending ? 'Creating account…' : 'Create account'}
          </Button>
          <p className="text-muted-foreground text-center text-sm md:hidden">
            Already a member?{' '}
            <Link to="/login" className="text-foreground font-medium underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </form>
      </Form>
    </AuthLayout>
  );
}
