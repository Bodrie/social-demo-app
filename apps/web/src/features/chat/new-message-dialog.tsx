import { type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PeoplePicker } from './people-picker';

/** Pick a person to write to; opens the direct thread with them. */
export function NewMessageDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>Who do you want to write to?</DialogDescription>
        </DialogHeader>
        <PeoplePicker
          searchLabel="Search people to message"
          onPick={(user) => {
            setOpen(false);
            void navigate(`/messages/with/${user.username}`);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
