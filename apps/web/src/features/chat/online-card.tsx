import { cn } from 'cn';
import { Link } from 'react-router';
import { UserAvatar } from '@/components/user-avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/features/auth/current-user';
import { useChat } from './chat-context';
import { PresenceDot } from './presence-dot';

/** Who else is online right now; each row opens a conversation. */
export function OnlineCard({ className }: { className?: string }) {
  const me = useCurrentUser();
  const { online, connected } = useChat();
  const others = online.filter((user) => user.id !== me.id);

  return (
    <Card className={cn('gap-3 py-4', className)}>
      <CardHeader className="px-4">
        <CardTitle>Online now</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {!connected ? (
          <p className="text-muted-foreground text-sm">Connecting…</p>
        ) : others.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nobody else is online right now.</p>
        ) : (
          <ul aria-label="Online now" className="-mx-1 space-y-1">
            {others.map((user) => (
              <li key={user.id}>
                <Link
                  to={`/messages/with/${user.username}`}
                  className="hover:bg-muted flex items-center gap-3 rounded-lg px-1 py-1"
                >
                  <span className="relative">
                    <UserAvatar user={user} size="lg" />
                    <PresenceDot online />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{user.name}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      @{user.username}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
