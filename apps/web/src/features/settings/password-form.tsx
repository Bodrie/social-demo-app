import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@beso/shared';
import { useMutation } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { applyApiErrors } from '@/features/auth/form-errors';
import { changePassword } from '@/lib/api/auth';

const formSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: 'Choose a password you have not used just now',
    path: ['newPassword'],
  })
  .refine((value) => value.confirmPassword === value.newPassword, {
    message: 'The passwords do not match',
    path: ['confirmPassword'],
  });
type FormValues = z.infer<typeof formSchema>;

const EMPTY: FormValues = { currentPassword: '', newPassword: '', confirmPassword: '' };

export function PasswordForm() {
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: EMPTY });
  const change = useMutation({
    mutationFn: ({ currentPassword, newPassword }: FormValues) =>
      changePassword({ currentPassword, newPassword }),
  });

  const onSubmit = (values: FormValues) => {
    change.mutate(values, {
      onSuccess: () => {
        toast.success('Password changed. Other devices were signed out.');
        form.reset(EMPTY);
      },
      onError: (error) => applyApiErrors(error, form.setError, ['currentPassword', 'newPassword']),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" className="pr-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" className="pr-11" {...field} />
              </FormControl>
              <FormDescription>At least 8 characters.</FormDescription>
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
                <PasswordInput autoComplete="new-password" className="pr-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
          {change.isPending ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </Form>
  );
}
