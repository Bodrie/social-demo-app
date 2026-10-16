import { zodResolver } from '@hookform/resolvers/zod';
import {
  type UpdateProfileData,
  type UpdateProfileInput,
  type UserPrivate,
  updateProfileSchema,
} from '@the-mesh/shared';
import { PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/current-user';
import { applyApiErrors } from '@/features/auth/form-errors';
import { ImageField } from '@/features/uploads/image-field';
import { useImageUpload } from '@/features/uploads/use-image-upload';
import { type ImageChange, buildProfilePatch } from './profile-patch';
import { useUpdateProfile } from './use-update-profile';

const BIO_MAX = 300;

export function EditProfileDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PencilIcon /> Edit profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update how other people see you.</DialogDescription>
        </DialogHeader>
        <EditProfileForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function imageChange(
  upload: ReturnType<typeof useImageUpload>,
  removed: boolean,
  currentUrl: string | null,
): ImageChange {
  if (upload.state.status === 'ready') return upload.state.upload.key;
  if (removed && currentUrl) return null;
  return undefined;
}

function defaultsFor(me: UserPrivate): UpdateProfileInput {
  return {
    name: me.name,
    username: me.username,
    city: me.city ?? '',
    website: me.website ?? '',
    bio: me.bio ?? '',
  };
}

function EditProfileForm({ onDone }: { onDone: () => void }) {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const update = useUpdateProfile();
  const avatar = useImageUpload('avatar');
  const cover = useImageUpload('cover');
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const form = useForm<UpdateProfileInput, unknown, UpdateProfileData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: defaultsFor(me),
  });

  const uploading = avatar.state.status === 'uploading' || cover.state.status === 'uploading';
  const bioLength = useWatch({ control: form.control, name: 'bio' })?.length ?? 0;

  const onSubmit = (values: UpdateProfileData) => {
    const patch = buildProfilePatch(me, values, {
      avatar: imageChange(avatar, avatarRemoved, me.avatarUrl),
      cover: imageChange(cover, coverRemoved, me.coverUrl),
    });
    if (!patch) {
      onDone();
      return;
    }
    update.mutate(patch, {
      onSuccess: ({ user }) => {
        toast.success('Profile updated');
        onDone();
        if (user.username !== me.username) void navigate(`/u/${user.username}`, { replace: true });
      },
      onError: (error) =>
        applyApiErrors(error, form.setError, ['name', 'username', 'city', 'website', 'bio']),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <ImageField
          kind="cover"
          label="Cover"
          currentUrl={me.coverUrl}
          upload={cover}
          removed={coverRemoved}
          onRemovedChange={setCoverRemoved}
        />
        <ImageField
          kind="avatar"
          label="Avatar"
          currentUrl={me.avatarUrl}
          upload={avatar}
          removed={avatarRemoved}
          onRemovedChange={setAvatarRemoved}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" {...field} value={field.value ?? ''} />
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
                  <Input autoComplete="username" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {/* Read-only until a new address can be confirmed before it replaces this one (ADR 0011). */}
        <div className="grid gap-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input
            id="profile-email"
            type="email"
            value={me.email}
            readOnly
            aria-describedby="profile-email-note"
          />
          <p id="profile-email-note" className="text-muted-foreground text-sm">
            Only you can see your email. Changing it is not possible yet.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input autoComplete="address-level2" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    autoComplete="url"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="A few words about you"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription className="text-right tabular-nums">
                {bioLength}/{BIO_MAX}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={uploading || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
