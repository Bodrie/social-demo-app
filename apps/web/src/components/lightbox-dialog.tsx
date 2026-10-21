import { cn } from 'cn';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { LightboxProps } from './lightbox';

/** A horizontal move this long (px), clearly more sideways than up or down, is a swipe. */
const SWIPE_DISTANCE = 50;

const controlClass =
  'bg-scrim-foreground/10 text-scrim-foreground hover:bg-scrim-foreground/20 hover:text-scrim-foreground rounded-full';

/** The viewer itself, loaded on demand by `Lightbox`. */
export default function LightboxDialog({
  images,
  index,
  onIndexChange,
  title,
  alt,
}: Omit<LightboxProps, 'index'> & { index: number }) {
  const count = images.length;
  const image = images[index];
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  // A swipe ends with a click on whatever it ended on; that click must not close the viewer.
  const swiped = useRef(false);
  // Radix hands focus back to its own trigger, and nothing here is one: remember who opened it.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  // Round and round: the arrows never run out, so neither of them ever loses focus to `disabled`.
  const go = (step: number) => onIndexChange((index + step + count) % count);

  const onKeyDown = (event: KeyboardEvent) => {
    if (count < 2) return;
    if (event.key === 'ArrowLeft') go(-1);
    else if (event.key === 'ArrowRight') go(1);
    else return;
    event.preventDefault();
  };

  // Touch and pen only: a mouse has the arrows.
  const onPointerDown = (event: PointerEvent) => {
    swiped.current = false;
    if (event.pointerType === 'mouse' || !event.isPrimary) return;
    swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== event.pointerId || count < 2) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    swiped.current = true;
    go(dx < 0 ? 1 : -1);
  };

  if (!image) return null;
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => (open ? undefined : onIndexChange(null))}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="text-scrim-foreground fixed inset-0 z-50 flex flex-col outline-none"
          onKeyDown={onKeyDown}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener?.focus();
          }}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <div className="flex items-center justify-between gap-2 p-3">
            {count > 1 ? (
              <output className="px-2 text-sm font-medium tabular-nums">
                <span aria-hidden="true">
                  {index + 1} / {count}
                </span>
                <span className="sr-only">
                  {index + 1} of {count}
                </span>
              </output>
            ) : (
              <span />
            )}
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close" className={controlClass}>
                <XIcon />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {/* The stage: a click beside the picture closes, a swipe moves on. */}
          {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Escape and the Close button are the keyboard's way out */}
          <div
            className="relative flex min-h-0 flex-1 touch-none items-center justify-center px-2 pb-4 select-none sm:px-16"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              swipe.current = null;
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget && !swiped.current) onIndexChange(null);
            }}
          >
            <img
              key={image.url}
              src={image.url}
              width={image.width ?? undefined}
              height={image.height ?? undefined}
              alt={count > 1 ? `${alt}, ${index + 1} of ${count}` : alt}
              draggable={false}
              className="max-h-full max-w-full object-contain"
            />
            {count > 1 ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Previous picture"
                  className={cn(controlClass, 'absolute top-1/2 left-2 -translate-y-1/2 sm:left-4')}
                  onClick={() => go(-1)}
                >
                  <ChevronLeftIcon className="size-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Next picture"
                  className={cn(
                    controlClass,
                    'absolute top-1/2 right-2 -translate-y-1/2 sm:right-4',
                  )}
                  onClick={() => go(1)}
                >
                  <ChevronRightIcon className="size-6" />
                </Button>
              </>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
