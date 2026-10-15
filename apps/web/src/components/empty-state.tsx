import { AlertTriangleIcon, InboxIcon, type LucideIcon, RefreshCwIcon } from 'lucide-react';
import { cn } from 'cn';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'bg-card flex flex-col items-center gap-2 rounded-xl border px-6 py-12 text-center',
        className,
      )}
    >
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h2 className="font-semibold">{title}</h2>
      {description ? <p className="text-muted-foreground max-w-sm text-sm">{description}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

type ErrorStateProps = { message: string; onRetry?: () => void; className?: string };

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <EmptyState
      icon={AlertTriangleIcon}
      title="Something went wrong"
      description={message}
      className={className}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCwIcon /> Try again
          </Button>
        ) : undefined
      }
    />
  );
}
