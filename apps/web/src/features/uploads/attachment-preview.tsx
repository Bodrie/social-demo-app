import { cn } from 'cn';
import { Loader2Icon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ImageUploadState } from './use-image-upload';

type AttachmentPreviewProps = {
  state: Exclude<ImageUploadState, { status: 'idle' }>;
  onRetry: () => void;
  onRemove: () => void;
  /** Numbers the preview and its buttons when a composer holds several (1-based). */
  position?: number;
  className?: string;
  imageClassName?: string;
};

/** The picture a composer is about to send: local preview, upload progress, failure with retry. */
export function AttachmentPreview({
  state,
  onRetry,
  onRemove,
  position,
  className,
  imageClassName,
}: AttachmentPreviewProps) {
  const suffix = position === undefined ? '' : ` ${position}`;
  return (
    <div className={cn('relative overflow-hidden rounded-lg border', className)}>
      <img
        src={state.previewUrl}
        alt={`Attachment preview${suffix}`}
        className={cn(
          'max-h-80 w-full object-cover',
          state.status === 'uploading' && 'opacity-60',
          imageClassName,
        )}
      />
      {state.status === 'uploading' ? (
        <div className="bg-background/40 absolute inset-0 flex items-center justify-center">
          <Loader2Icon className="size-6 animate-spin" aria-hidden="true" />
          <span className="sr-only">Uploading image{suffix}</span>
        </div>
      ) : null}
      {state.status === 'error' ? (
        <div className="bg-destructive absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-3 py-2 text-sm text-white">
          <span>{state.message}</span>
          <Button type="button" size="xs" variant="secondary" onClick={onRetry}>
            Retry<span className="sr-only">{suffix}</span>
          </Button>
        </div>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="icon-xs"
        className="absolute top-2 right-2 rounded-full shadow"
        aria-label={`Remove image${suffix}`}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </div>
  );
}
