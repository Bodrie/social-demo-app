import { GROUP_MAX_MEMBERS } from '@the-mesh/shared';
import type { Conversation } from '@the-mesh/shared';
import { LogOutIcon, UserPlusIcon } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCurrentUser } from '@/features/auth/current-user';
import { isApiClientError } from '@/lib/api/client';
import { useChat } from './chat-context';
import { PeoplePicker } from './people-picker';
import { PresenceDot } from './presence-dot';
import { useAddMembers, useLeaveGroup } from './use-conversations';

type GroupMembersDialogProps = { conversation: Conversation; children: ReactNode };

/** Who is in the group, with a way to bring people in and a way out. */
export function GroupMembersDialog({ conversation, children }: GroupMembersDialogProps) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const me = useCurrentUser();
  const { isOnline } = useChat();
  const navigate = useNavigate();
  const addMembers = useAddMembers(conversation.id);
  const leaveGroup = useLeaveGroup();
  const memberIds = conversation.members.map((member) => member.user.id);
  const pickerId = useId();

  const add = (userId: string) => {
    if (conversation.members.length >= GROUP_MAX_MEMBERS) {
      toast.error(`A group can have at most ${GROUP_MAX_MEMBERS} members`);
      return;
    }
    addMembers.mutate(
      { userIds: [userId] },
      {
        onError: (error) =>
          toast.error(
            isApiClientError(error)
              ? (error.fields.userIds ?? error.message)
              : 'Could not add that person',
          ),
      },
    );
  };

  const leave = () =>
    leaveGroup.mutate(conversation.id, {
      onSuccess: () => {
        setOpen(false);
        void navigate('/messages');
      },
      onError: (error) =>
        toast.error(isApiClientError(error) ? error.message : 'Could not leave the group'),
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setAdding(false);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{conversation.title}</DialogTitle>
          <DialogDescription>
            {conversation.members.length} {conversation.members.length === 1 ? 'member' : 'members'}
          </DialogDescription>
        </DialogHeader>
        <ul aria-label="Members" className="max-h-64 space-y-1 overflow-y-auto">
          {conversation.members.map(({ user }) => (
            <li key={user.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
              <span className="relative shrink-0">
                <UserAvatar user={user} size="lg" />
                <PresenceDot online={isOnline(user.id)} />
              </span>
              <span className="min-w-0 flex-1">
                <Link
                  to={`/u/${user.username}`}
                  className="block truncate text-sm font-semibold hover:underline"
                >
                  {user.name}
                  {user.id === me.id ? (
                    <span className="text-muted-foreground font-normal"> (you)</span>
                  ) : null}
                </Link>
                <span className="text-muted-foreground block truncate text-xs">
                  {user.id === conversation.createdById ? 'Created the group' : `@${user.username}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
        {adding ? (
          <PeoplePicker
            id={pickerId}
            searchLabel="Search people to add"
            excludeIds={memberIds}
            focusOnMount
            onPick={(user) => add(user.id)}
          />
        ) : null}
        <div className="flex items-center justify-between gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={adding}
            aria-controls={adding ? pickerId : undefined}
            onClick={() => setAdding((value) => !value)}
          >
            <UserPlusIcon /> Add people
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <LogOutIcon /> Leave group
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave {conversation.title}?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will stop receiving its messages. Someone in the group can add you again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Stay</AlertDialogCancel>
                <AlertDialogAction onClick={leave} disabled={leaveGroup.isPending}>
                  Leave
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}
