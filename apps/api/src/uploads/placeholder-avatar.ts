import sharp from 'sharp';

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return hash;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => `&#${char.codePointAt(0)};`);
}

/** A 512×512 WebP with a coloured background and one initial. Used by the seed. */
export function placeholderAvatar(initial: string, seed: string): Promise<Buffer> {
  const hue = hashString(seed) % 360;
  const letter = escapeXml(initial.slice(0, 1).toUpperCase() || '?');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect width="512" height="512" fill="hsl(${hue} 55% 45%)"/>
    <text x="50%" y="50%" dy=".36em" text-anchor="middle" font-family="sans-serif" font-size="260" font-weight="700" fill="#ffffff">${letter}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}
