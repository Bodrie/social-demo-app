/** A region of the source picture in its own pixels, as the cropper reports it. */
export type CropArea = { x: number; y: number; width: number; height: number };

/** The largest output the caller wants; the API resizes to its preset anyway. */
export type CropOutput = { width: number; height: number };

const JPEG_QUALITY = 0.92;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(new Error('The picture could not be read')), {
      once: true,
    });
    image.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, JPEG_QUALITY);
  });
}

function renamed(name: string, type: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'picture';
  return `${base}.${type === 'image/jpeg' ? 'jpg' : 'png'}`;
}

/**
 * Draws `area` of the picture at `src` onto a canvas and hands it back as a file for the upload.
 * The result is scaled down to fit `output` (never up: a small source stays small and the API
 * enlarges it as it does today). JPEG sources stay JPEG; anything else becomes PNG so an alpha
 * channel survives. Browsers orient the picture by its EXIF both when showing it and when
 * drawing it, so the area the member framed is the area drawn.
 */
export async function cropImage(
  src: string,
  area: CropArea,
  output: CropOutput,
  source: Pick<File, 'name' | 'type'>,
): Promise<File> {
  const image = await loadImage(src);
  const scale = Math.min(1, output.width / area.width, output.height / area.height);
  const width = Math.max(1, Math.round(area.width * scale));
  const height = Math.max(1, Math.round(area.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The picture could not be drawn');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height);

  const blob = await toBlob(canvas, source.type === 'image/jpeg' ? 'image/jpeg' : 'image/png');
  if (!blob) throw new Error('The picture could not be encoded');
  return new File([blob], renamed(source.name, blob.type), { type: blob.type });
}
