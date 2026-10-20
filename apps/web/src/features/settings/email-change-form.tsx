import { zodResolver } from '@hookform/resolvers/zod';
import { emailSchema } from '@beso/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Input } from '@/components/ui/input';
import { applyApiErrors } from '@/features/auth/form-errors';
import { setMe } from '@/features/auth/use-me';
import { requestEmailChange } from '@/lib/api/account';

const formSchema = z.object({
  newEmail: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});
type FormValues = z.infer<typeof formSchema>;
const EMPTY: FormValues = { newEmail: '', password: '' };

/**
 * Asks for a new address: a link goes there, a notice to the current one, and nothing changes
 * until the link is opened (ADR 0010 amendment). Used in Settings and in the waiting room.
 */
export function EmailChangeForm({ onRequested }: { onRequested?: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: EMPTY });
  const request = useMutation({ mutationFn: requestEmailChange });

  const onSubmit = (values: FormValues) => {
    request.mutate(values, {
      onSuccess: ({ user }) => {
        setMe(queryClient, { user });
        toast.success(`We sent a link to ${user.pendingEmail ?? values.newEmail}`);
        form.reset(EMPTY);
        onRequested?.();
      },
      onError: (error) => applyApiErrors(error, form.setError, ['newEmail', 'password']),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="newEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New email address</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormDescription>
                We send a link there; the address changes once you open it.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" className="pr-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={request.isPending}>
          {request.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
          {request.isPending ? 'Sending…' : 'Send confirmation link'}
        </Button>
      </form>
    </Form>
  );
}
