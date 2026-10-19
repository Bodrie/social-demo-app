import { APP_NAME } from '@the-mesh/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { Link } from 'react-router';
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
import { announceSessionChange, endSession } from '@/features/auth/use-me';
import { logoutEverywhere } from '@/lib/api/auth';
import { REPOSITORY_URL } from '@/lib/env';
import { usePageTitle } from '@/lib/use-page-title';
import { cn } from 'cn';
import { AccountCard } from './account-card';
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
          <CardTitle asChild>
            <h2>Appearance</h2>
          </CardTitle>
          <CardDescription>Follow the system or pick a side.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePicker />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>Password</h2>
          </CardTitle>
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
          <CardTitle asChild>
            <h2>Sessions</h2>
          </CardTitle>
          <CardDescription>
            Signed in somewhere you do not recognise? End every session, this one included.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutEverywhere />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>About</h2>
          </CardTitle>
          <CardDescription>
            {APP_NAME} is a demo social network. The small print lives here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <li>
              <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">
                Privacy notice
              </Link>
            </li>
            <li>
              <Link to="/terms" className="text-primary underline-offset-4 hover:underline">
                Terms of use
              </Link>
            </li>
            <li>
              <a
                href={REPOSITORY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Source code
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>

      <AccountCard />
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
    onSuccess: () => {
      toast.success('Signed out everywhere');
      endSession(queryClient, { deliberate: true });
      announceSessionChange();
    },
    onError: () => toast.error('Could not sign out everywhere. Please try again.'),
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
