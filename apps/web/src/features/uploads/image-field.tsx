import { UPLOAD_LIMITS } from '@the-mesh/shared';
import { cn } from 'cn';
import { ImageIcon, Loader2Icon } from 'lucide-react';
import { type ChangeEvent, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { useImageUpload } from './use-image-upload';

type ImageFieldProps = {
  kind: 'avatar' | 'cover';
  label: string;
  currentUrl: string | null;
  upload: ReturnType<typeof useImageUpload>;
  /** The viewer asked to remove the current picture (and has not picked a new one). */
  removed: boolean;
  onRemovedChange: (removed: boolean) => void;
};

/** Picture picker for the profile form: shows the current, the pending upload or nothing. */
export function ImageField({
  kind,
  label,
  currentUrl,
  upload,
  removed,
  onRemovedChange,
}: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { state } = upload;
  const previewUrl = state.status === 'idle' ? (removed ? null : currentUrl) : state.previewUrl;
  const isCover = kind === 'cover';

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const problem = upload.select(file);
    if (problem) toast.error(problem);
    else onRemovedChange(false);
  };

  const remove = () => {
    upload.clear();
    onRemovedChange(true);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className={cn('flex gap-4', isCover ? 'flex-col items-start' : 'items-center')}>
        <div
          className={cn(
            'bg-muted relative shrink-0 overflow-hidden border',
            isCover ? 'aspect-[3/1] w-full rounded-lg' : 'size-20 rounded-full',
          )}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className={cn('size-full object-cover', state.status === 'uploading' && 'opacity-60')}
            />
          ) : (
            <div className="text-muted-foreground flex size-full items-center justify-center">
              <ImageIcon className="size-6" aria-hidden="true" />
            </div>
          )}
          {state.status === 'uploading' ? (
            <div className="bg-background/40 absolute inset-0 flex items-center justify-center">
              <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
              <span className="sr-only">Uploading</span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={UPLOAD_LIMITS.acceptedTypes.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-label={`Choose ${label.toLowerCase()}`}
            onChange={pick}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            {previewUrl ? 'Change' : 'Upload'}
          </Button>
          {previewUrl ? (
            <Button type="button" variant="ghost" size="sm" onClick={remove}>
              Remove
            </Button>
          ) : null}
          {state.status === 'error' ? (
            <span className="text-destructive text-sm">
              {state.message}{' '}
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={upload.retry}
              >
                Retry
              </Button>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
