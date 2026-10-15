import { SmileIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Suspense, lazy } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';

const EmojiPickerPanel = lazy(() => import('./emoji-picker'));

export function EmojiPickerButton({ onPick }: { onPick: (emoji: string) => void }) {
  const { resolvedTheme } = useTheme();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Add emoji">
          <SmileIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto overflow-hidden p-0">
        <Suspense fallback={<Skeleton className="h-[360px] w-[320px] rounded-none" />}>
          <EmojiPickerPanel dark={resolvedTheme === 'dark'} onPick={onPick} />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
