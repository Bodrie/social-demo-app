import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { endSession } from '@/features/auth/use-me';
import { logoutEverywhere } from '@/lib/api/auth';
import { usePageTitle } from '@/lib/use-page-title';
import { cn } from 'cn';
import { PasswordForm } from './password-form';

const THEMES = [
  { value: 'system', label: 'System', icon: MonitorIcon },
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
] as const;

export function SettingsPage() {
  usePageTitle('Settings');
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border p-4">
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Your account and how the app looks.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Follow the system or pick a side.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePicker />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Changing it signs out every other device; this one stays signed in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            Signed in somewhere you do not recognise? End every session, this one included.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutEverywhere />
        </CardContent>
      </Card>
    </div>
  );
}

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Theme</legend>
      {THEMES.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          variant="outline"
          aria-pressed={theme === value}
          className={cn(theme === value && 'border-primary bg-accent text-accent-foreground')}
          onClick={() => setTheme(value)}
        >
          <Icon /> {label}
        </Button>
      ))}
    </fieldset>
  );
}

function SignOutEverywhere() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const signOut = useMutation({
    mutationFn: logoutEverywhere,
    onSettled: () => {
      toast.success('Signed out everywhere');
      endSession(queryClient);
    },
  });
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Sign out everywhere</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out of every device?</AlertDialogTitle>
          <AlertDialogDescription>
            Every session ends right away, including this one. You can sign in again at once.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: 'destructive' })}
            onClick={() => signOut.mutate()}
          >
            Sign out everywhere
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
