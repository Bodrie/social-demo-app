import type { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import type { Env } from '../config/env.js';
import { ImageProcessor } from './image-processor.js';

const processor = new ImageProcessor({ get: () => 2_000_000 } as unknown as ConfigService<
  Env,
  true
>);

function image(width: number, height: number, format: 'png' | 'jpeg' = 'png'): Promise<Buffer> {
  const pipeline = sharp({ create: { width, height, channels: 3, background: '#336699' } });
  return format === 'png' ? pipeline.png().toBuffer() : pipeline.jpeg().toBuffer();
}

describe('ImageProcessor', () => {
  it('turns an avatar upload into a 512×512 WebP', async () => {
    const result = await processor.process(await image(800, 600), 'avatar');
    const meta = await sharp(result.data).metadata();

    expect(result).toMatchObject({ width: 512, height: 512, contentType: 'image/webp' });
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(512);
  });

  it('keeps post images inside 1920px without enlarging', async () => {
    const small = await processor.process(await image(800, 600), 'post');
    expect([small.width, small.height]).toEqual([800, 600]);
  });

  it('crops covers to the banner ratio', async () => {
    const cover = await processor.process(await image(800, 800), 'cover');
    expect([cover.width, cover.height]).toEqual([1600, 600]);
  });

  it('strips metadata', async () => {
    const withExif = await sharp(await image(100, 100, 'jpeg'))
      .withMetadata({ exif: { IFD0: { Copyright: 'secret location data' } } })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const result = await processor.process(withExif, 'post');
    expect((await sharp(result.data).metadata()).exif).toBeUndefined();
  });

  it('rejects files that are not images, whatever they claim to be', async () => {
    await expect(processor.process(Buffer.from('<html>hi</html>'), 'post')).rejects.toMatchObject({
      status: 415,
    });
  });

  it('rejects SVG', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
    );
    await expect(processor.process(svg, 'post')).rejects.toMatchObject({ status: 415 });
  });

  it('rejects images above the pixel budget', async () => {
    await expect(processor.process(await image(2000, 1500), 'post')).rejects.toMatchObject({
      status: 400,
    });
  });
});
