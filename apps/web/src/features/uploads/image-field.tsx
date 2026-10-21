import { type ProfilePictureKind, UPLOAD_LIMITS } from '@beso/shared';
import { cn } from 'cn';
import { ImageIcon, Loader2Icon } from 'lucide-react';
import { type ChangeEvent, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { describeImageProblem, type useImageUpload } from './use-image-upload';

const ImageCropper = lazy(() => import('./image-cropper'));

type ImageFieldProps = {
  kind: ProfilePictureKind;
  label: string;
  currentUrl: string | null;
  upload: ReturnType<typeof useImageUpload>;
  /** The viewer asked to remove the current picture (and has not picked a new one). */
  removed: boolean;
  onRemovedChange: (removed: boolean) => void;
};

type Pending = { file: File; url: string };

/**
 * Picture picker for the profile form: shows the current picture, the pending upload or nothing.
 * A chosen file first goes through the cropper (in place of the preview); only the framed
 * picture is uploaded, so cancelling leaves the current one untouched.
 */
export function ImageField({
  kind,
  label,
  currentUrl,
  upload,
  removed,
  onRemovedChange,
}: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const { state } = upload;
  const previewUrl = state.status === 'idle' ? (removed ? null : currentUrl) : state.previewUrl;
  const isCover = kind === 'cover';

  // The object URL lives as long as the cropper shows it.
  useEffect(() => {
    const url = pending?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [pending]);

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const problem = describeImageProblem(file);
    if (problem) toast.error(problem);
    else setPending({ file, url: URL.createObjectURL(file) });
  };

  // Focus returns to the Change button once the cropper has left the DOM. Not a frame later:
  // after "Use this" the close follows an await, React renders it at default priority and under
  // load the next frame can come before that commit, when the button does not exist yet.
  const returnFocus = useRef(false);
  useEffect(() => {
    if (pending || !returnFocus.current) return;
    returnFocus.current = false;
    changeRef.current?.focus();
  }, [pending]);

  const closeCropper = () => {
    returnFocus.current = true;
    setPending(null);
  };

  const useCropped = (file: File) => {
    closeCropper();
    const problem = upload.select(file);
    if (problem) toast.error(problem);
    else onRemovedChange(false);
  };

  const remove = () => {
    upload.clear();
    onRemovedChange(true);
  };

  if (pending) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <Suspense fallback={<CropperFallback isCover={isCover} />}>
          <ImageCropper
            kind={kind}
            label={label}
            file={pending.file}
            src={pending.url}
            onConfirm={useCropped}
            onCancel={closeCropper}
          />
        </Suspense>
      </div>
    );
  }

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
            ref={changeRef}
            type="button"
            variant="outline"
            size="sm"
            aria-label={`${previewUrl ? 'Change' : 'Upload'} ${label.toLowerCase()}`}
            onClick={() => inputRef.current?.click()}
          >
            {previewUrl ? 'Change' : 'Upload'}
          </Button>
          {previewUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove ${label.toLowerCase()}`}
              onClick={remove}
            >
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

function CropperFallback({ isCover }: { isCover: boolean }) {
  return (
    <div
      className={cn(
        'bg-muted flex w-full animate-pulse items-center justify-center rounded-lg border',
        isCover ? 'aspect-[2/1]' : 'h-64',
      )}
    >
      <Loader2Icon className="text-muted-foreground size-5 animate-spin" aria-hidden="true" />
      <span className="sr-only">Loading the picture</span>
    </div>
  );
}
