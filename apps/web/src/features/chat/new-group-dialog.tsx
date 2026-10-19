import { GROUP_MAX_MEMBERS, GROUP_TITLE_MAX_LENGTH, type UserSummary } from '@the-mesh/shared';
import { XIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useId, useRef, useState } from 'react';
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
  // When the dialog closes because the group opened, focus belongs to the new page, not the trigger.
  const navigated = useRef(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(event) => {
          if (navigated.current) event.preventDefault();
          navigated.current = false;
        }}
      >
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>Give it a name and choose who is in.</DialogDescription>
        </DialogHeader>
        {open ? (
          <NewGroupForm
            onDone={() => {
              navigated.current = true;
              setOpen(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NewGroupForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const createGroup = useCreateGroup();
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [members, setMembers] = useState<UserSummary[]>([]);
  // The creator takes one seat.
  const seatsLeft = GROUP_MAX_MEMBERS - 1 - members.length;
  const trimmed = title.trim();
  const canCreate =
    trimmed.length > 0 &&
    trimmed.length <= GROUP_TITLE_MAX_LENGTH &&
    members.length > 0 &&
    !createGroup.isPending;

  const toggle = (user: UserSummary) => {
    const chosen = members.some((member) => member.id === user.id);
    if (!chosen && seatsLeft <= 0) {
      toast.error(`A group can have at most ${GROUP_MAX_MEMBERS} members`);
      return;
    }
    setMembers((current) =>
      chosen ? current.filter((member) => member.id !== user.id) : [...current, user],
    );
  };

  const remove = (user: UserSummary) => {
    toggle(user);
    // The chip's own button is gone with it; the search box is the natural next stop.
    searchRef.current?.focus();
  };

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
          toast.error(
            isApiClientError(error)
              ? (error.fields.memberIds ?? error.message)
              : 'Could not create the group',
          ),
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
                onClick={() => remove(member)}
              >
                <XIcon className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <PeoplePicker
        searchLabel="Search people to add"
        inputRef={searchRef}
        multiple
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
