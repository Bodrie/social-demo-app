import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DownloadIcon, Loader2Icon, Trash2Icon } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { toast } from 'sonner';
import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCurrentUser } from '@/features/auth/current-user';
import { announceSessionChange, endSession } from '@/features/auth/use-me';
import { deleteAccount, fetchAccountExport } from '@/lib/api/account';
import { isApiClientError } from '@/lib/api/client';
import { saveJsonFile } from '@/lib/download';

/** Settings → Your account: a copy of everything, or the way out (ADR 0012). */
export function AccountCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your account</CardTitle>
        <CardDescription>
          Take a copy of everything your account holds, or delete the account for good.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <DownloadData />
        <DeleteAccount />
      </CardContent>
    </Card>
  );
}

function DownloadData() {
  const me = useCurrentUser();
  const download = useMutation({
    mutationFn: fetchAccountExport,
    onSuccess: (data) => {
      saveJsonFile(`the-mesh-export-${me.username}-${data.exportedAt.slice(0, 10)}.json`, data);
      toast.success('Your data is downloading');
    },
    onError: (error) =>
      toast.error(
        isApiClientError(error) && error.status === 429
          ? 'You just downloaded your data. Try again in a minute.'
          : 'Could not prepare your data',
      ),
  });
  return (
    <Button variant="outline" disabled={download.isPending} onClick={() => download.mutate()}>
      {download.isPending ? (
        <Loader2Icon className="animate-spin" aria-hidden="true" />
      ) : (
        <DownloadIcon aria-hidden="true" />
      )}
      {download.isPending ? 'Preparing…' : 'Download your data'}
    </Button>
  );
}

function DeleteAccount() {
  const queryClient = useQueryClient();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const remove = useMutation({ mutationFn: deleteAccount });

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setPassword('');
      setError(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    remove.mutate(
      { password },
      {
        onSuccess: () => {
          toast.success('Your account was deleted');
          endSession(queryClient);
          announceSessionChange();
        },
        onError: (failure) =>
          setError(
            isApiClientError(failure)
              ? (failure.fields.password ?? failure.message)
              : 'Could not delete the account',
          ),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2Icon aria-hidden="true" /> Delete account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Your profile, posts, comments, messages and pictures are removed right away, and
              people you chatted with lose your side of the conversation. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`${id}-password`}>Your password</Label>
            <PasswordInput
              id={`${id}-password`}
              autoComplete="current-password"
              className="pr-11"
              value={password}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
            />
            {error ? (
              <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              disabled={password.length === 0 || remove.isPending}
            >
              {remove.isPending ? 'Deleting…' : 'Delete my account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
