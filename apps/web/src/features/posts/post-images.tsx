import type { StoredImage } from '@beso/shared';
import { cn } from 'cn';

type PostImagesProps = {
  images: readonly StoredImage[];
  /** "Posted by Alice": the pictures' alternative text when they cannot be opened. */
  alt: string;
  /** Opens the viewer at that picture; without it the pictures are plain images (quote embeds). */
  onOpen?: (index: number) => void;
  /** A single picture's height limit (the card's, taller on the post page, lower in an embed). */
  maxHeightClass?: string;
  className?: string;
};

/** Cells of the 2–4 grid: three pictures put the first one tall on the left. */
const gridClass: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 grid-rows-2 [&>*:first-child]:row-span-2',
  4: 'grid-cols-2 grid-rows-2',
};

/**
 * The pictures of a post (D2). One picture keeps its own proportions within a height limit, its
 * size reserving the space before it arrives; two to four share a 16:9 grid, so a card never
 * jumps while they load.
 */
export function PostImages({
  images,
  alt,
  onOpen,
  maxHeightClass = 'max-h-[32rem]',
  className,
}: PostImagesProps) {
  const count = images.length;
  if (count === 0) return null;
  const single = count === 1;

  // In the grid the pictures are taken out of the flow, so a large one cannot stretch its cell.
  const cellClass = single ? 'block w-full' : 'relative block size-full min-h-0';
  const picture = (image: StoredImage, index: number) => {
    const img = (
      <img
        src={image.url}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        // Inside a button the button's name speaks for it.
        alt={onOpen ? '' : single ? alt : `${alt}, ${index + 1} of ${count}`}
        loading="lazy"
        decoding="async"
        className={cn(
          'object-cover',
          single ? cn('block h-auto w-full', maxHeightClass) : 'absolute inset-0 size-full',
        )}
      />
    );
    if (!onOpen) {
      return (
        <div key={image.url} className={cellClass}>
          {img}
        </div>
      );
    }
    return (
      <button
        key={image.url}
        type="button"
        aria-label={single ? 'Open picture' : `Open picture ${index + 1} of ${count}`}
        aria-haspopup="dialog"
        // A double tap on the picture likes the post; a single one opens it (`useDoubleTap`).
        data-double-tap=""
        className={cn(
          cellClass,
          'focus-visible:outline-ring cursor-zoom-in focus-visible:outline-3 focus-visible:-outline-offset-3',
        )}
        onClick={() => onOpen(index)}
      >
        {img}
      </button>
    );
  };

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border',
        !single && cn('grid aspect-video gap-0.5', gridClass[count]),
        className,
      )}
    >
      {images.map(picture)}
    </div>
  );
}
