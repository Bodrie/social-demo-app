import { type ReactNode, useRef, useState } from 'react';
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
  // Picking someone opens their thread; focus belongs there, not back on the trigger.
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
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>Who do you want to write to?</DialogDescription>
        </DialogHeader>
        <PeoplePicker
          searchLabel="Search people to message"
          onPick={(user) => {
            navigated.current = true;
            setOpen(false);
            void navigate(`/messages/with/${user.username}`);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
