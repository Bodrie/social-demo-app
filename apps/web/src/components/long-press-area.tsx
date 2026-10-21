import { cn } from 'cn';
import type { ComponentProps } from 'react';
import { useLongPress } from '@/lib/use-long-press';

type LongPressAreaProps = Omit<ComponentProps<'div'>, 'onPointerDown' | 'onPointerMove'> & {
  /** Called once with the element after a held touch or pen press (`useLongPress`). */
  onLongPress: (element: HTMLElement) => void;
};

/**
 * A `div` that answers a press-and-hold. On coarse pointers it gives up text selection and
 * the iOS callout, so the hold is the gesture (as in native apps) rather than a selection.
 */
export function LongPressArea({ onLongPress, className, ...props }: LongPressAreaProps) {
  const handlers = useLongPress(onLongPress);
  return (
    <div
      {...props}
      {...handlers}
      className={cn(
        'pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none]',
        className,
      )}
    />
  );
}
