import { GROUP_TITLE_MAX_LENGTH, type UserSummary } from '@the-mesh/shared';
import { XIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useId, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isApiClientError } from '@/lib/api/client';
import { PeoplePicker } from './people-picker';
import { useCreateGroup } from './use-conversations';

/** Name a group and pick its members; opens the new group when it exists. */
export function NewGroupDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>Give it a name and choose who is in.</DialogDescription>
        </DialogHeader>
        {open ? <NewGroupForm onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function NewGroupForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const createGroup = useCreateGroup();
  const titleId = useId();
  const [title, setTitle] = useState('');
  const [members, setMembers] = useState<UserSummary[]>([]);
  const trimmed = title.trim();
  const canCreate =
    trimmed.length > 0 &&
    trimmed.length <= GROUP_TITLE_MAX_LENGTH &&
    members.length > 0 &&
    !createGroup.isPending;

  const toggle = (user: UserSummary) =>
    setMembers((current) =>
      current.some((member) => member.id === user.id)
        ? current.filter((member) => member.id !== user.id)
        : [...current, user],
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canCreate) return;
    createGroup.mutate(
      { title: trimmed, memberIds: members.map((member) => member.id) },
      {
        onSuccess: (conversation) => {
          onDone();
          void navigate(`/messages/${conversation.id}`);
        },
        onError: (error) =>
          toast.error(isApiClientError(error) ? error.message : 'Could not create the group'),
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={titleId}>Group name</Label>
        <Input
          id={titleId}
          value={title}
          maxLength={GROUP_TITLE_MAX_LENGTH}
          autoComplete="off"
          placeholder="Weekend plans"
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      {members.length > 0 ? (
        <ul aria-label="Chosen members" className="flex flex-wrap gap-1.5">
          {members.map((member) => (
            <li
              key={member.id}
              className="bg-accent text-accent-foreground flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs font-medium"
            >
              {member.name}
              <button
                type="button"
                aria-label={`Remove ${member.name}`}
                className="hover:bg-background/60 rounded-full p-0.5"
                onClick={() => toggle(member)}
              >
                <XIcon className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <PeoplePicker
        searchLabel="Search people to add"
        selectedIds={members.map((member) => member.id)}
        onPick={toggle}
      />
      <DialogFooter>
        <Button type="submit" disabled={!canCreate}>
          {createGroup.isPending ? 'Creating…' : 'Create group'}
        </Button>
      </DialogFooter>
    </form>
  );
}
