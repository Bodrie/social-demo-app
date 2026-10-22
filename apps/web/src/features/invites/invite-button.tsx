import { UserPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { InviteDialog } from './invite-dialog';

/** "Invite friends" on the member's own profile (F1). */
export function InviteButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UserPlusIcon /> Invite friends
      </Button>
      <InviteDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
