import type { StoredImage } from '@beso/shared';
import { Suspense, lazy } from 'react';

const LightboxDialog = lazy(() => import('./lightbox-dialog'));

export type LightboxProps = {
  images: readonly StoredImage[];
  /** The picture on screen, or null while the viewer is closed. */
  index: number | null;
  /** Another picture, or null when the viewer closes. */
  onIndexChange: (index: number | null) => void;
  /** Names the dialog ("Pictures posted by Alice"). */
  title: string;
  /**
   * Alternative text of every picture ("Posted by Alice"), or of the one at an index when they
   * differ (a chat's pictures come from several people); the position is added to it.
   */
  alt: string | ((index: number) => string);
};

/**
 * The full-screen picture viewer (D2): post pictures, chat pictures, profile pictures, each
 * with a download button. Its code loads the first time it opens; focus goes back to whatever
 * opened it when it closes.
 */
export function Lightbox({ index, ...props }: LightboxProps) {
  if (index === null || props.images.length === 0) return null;
  return (
    <Suspense fallback={null}>
      <LightboxDialog index={Math.min(index, props.images.length - 1)} {...props} />
    </Suspense>
  );
}
