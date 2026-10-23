import {
  AVATAR_PRESETS,
  COVER_PRESETS,
  type PresetKind,
  type PresetPicture,
} from '@beso/shared/pictures';
import { cn } from 'cn';
import { LockIcon } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { presetUrl } from '@/lib/presets';

type PicturePickerProps = {
  kind: PresetKind;
  legend: string;
  /** The picture picked; null for none (the initials, or a photo of one's own). */
  value: string | null;
  onChange: (id: string | null) => void;
  /**
   * Whether the earned pictures show, and why one is still locked (null: it is not). Without
   * it only the free ones are offered (the registration form, which knows no badges).
   */
  lockOf?: (preset: PresetPicture) => string | null;
  /** A first option meaning "none of these" (the registration form's initials). */
  none?: { label: string; picture: ReactNode };
  className?: string;
};

/**
 * The ready-made avatars or covers (ADR 0021, "Rewards") as a group of radio buttons: the free
 * ones for everyone, the earned ones once their badge is held and, before that, shown locked
 * with the badge that unlocks them (a hidden badge stays unnamed).
 */
export function PicturePicker({
  kind,
  legend,
  value,
  onChange,
  lockOf,
  none,
  className,
}: PicturePickerProps) {
  const name = useId();
  const isCover = kind === 'cover';
  const presets = (isCover ? COVER_PRESETS : AVATAR_PRESETS).filter(
    (preset) => lockOf !== undefined || preset.unlockedBy === null,
  );
  const option = (
    key: string,
    id: string | null,
    label: string,
    picture: ReactNode,
    locked: string | null,
  ) => (
    <label
      key={key}
      title={locked ?? label}
      className={cn(
        'relative block cursor-pointer overflow-hidden border-2 border-transparent transition',
        'has-[:checked]:border-primary has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-2',
        isCover ? 'aspect-[3/1] rounded-lg' : 'aspect-square rounded-full',
        locked && 'cursor-not-allowed',
      )}
    >
      <input
        type="radio"
        name={name}
        className="sr-only"
        checked={value === id}
        disabled={locked !== null}
        onChange={() => onChange(id)}
      />
      <span aria-hidden="true" className={cn('block size-full', locked && 'opacity-40 grayscale')}>
        {picture}
      </span>
      <span className="sr-only">
        {label}
        {locked ? ` (${locked})` : ''}
      </span>
      {locked ? (
        <span
          aria-hidden="true"
          className="bg-background/90 text-muted-foreground absolute right-1 bottom-1 rounded-full p-1"
        >
          <LockIcon className="size-3" />
        </span>
      ) : null}
    </label>
  );

  return (
    <fieldset className={cn('space-y-2', className)}>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className={cn('grid gap-2', isCover ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-6')}>
        {none ? option('none', null, none.label, none.picture, null) : null}
        {presets.map((preset) =>
          option(
            preset.id,
            preset.id,
            preset.label,
            <img
              src={presetUrl(kind, preset.id)}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />,
            lockOf?.(preset) ?? null,
          ),
        )}
      </div>
    </fieldset>
  );
}
