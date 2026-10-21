/**
 * Traces the wordmark from a picture of the reference logotype into filled outlines and writes
 * `scripts/wordmark.json`, which `brand-assets.mjs` reads. One-off tooling: the picture is the
 * source of the letterforms, so the trace is data, re-run only with a better picture.
 *
 *   npm i potrace@2.1.8 --prefix /tmp/potrace --no-save
 *   POTRACE_DIR=/tmp/potrace/node_modules node scripts/trace-wordmark.mjs <reference.png>
 *
 * The picture is expected to be the letters alone (dark or coloured ink on a light ground).
 * Settings (env): SCALE (upscale factor, 12), BLUR (px after upscaling, 3), SAT (the colour
 * difference that counts as ink, 105 of 255), ALPHA (potrace corner smoothing, 1.3) and OPT
 * (curve simplification, 1.0). Output: a 48-tall box, cap height 40 (y 4..44), "Be" and "So"
 * as separate paths so the accent can take "So".
 */
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(path.join(root, 'apps/api/package.json'))('sharp');
const potraceDir = process.env.POTRACE_DIR;
if (!potraceDir) throw new Error('POTRACE_DIR must point at a node_modules holding potrace');
const potrace = createRequire(path.join(potraceDir, 'potrace/package.json'))('potrace');
const source = process.argv[2];
if (!source) throw new Error('usage: node scripts/trace-wordmark.mjs <reference.png>');

const SCALE = Number(process.env.SCALE ?? 12);
const BLUR = Number(process.env.BLUR ?? 3);
const SAT = Number(process.env.SAT ?? 105);
const ALPHA = Number(process.env.ALPHA ?? 1.3);
const OPT = Number(process.env.OPT ?? 1.0);
const out = path.join(root, 'scripts/wordmark.json');
const maskFile = path.join(root, 'scripts/.wordmark-mask.png');

// 1. Upscale, soften, keep what is clearly ink rather than ground.
const meta = await sharp(source).metadata();
const { data, info } = await sharp(source)
  .resize({ width: meta.width * SCALE, height: meta.height * SCALE, kernel: 'lanczos3' })
  .blur(BLUR)
  .raw()
  .toBuffer({ resolveWithObject: true });
const mask = Buffer.alloc(info.width * info.height);
for (let i = 0; i < info.width * info.height; i++) {
  const r = data[i * info.channels];
  const g = data[i * info.channels + 1];
  const b = data[i * info.channels + 2];
  const colourful = Math.max(r, g, b) - Math.min(r, g, b) > SAT;
  const dark = (r + g + b) / 3 < 255 - SAT;
  mask[i] = colourful || dark ? 0 : 255;
}
await sharp(mask, { raw: { width: info.width, height: info.height, channels: 1 } })
  .png()
  .toFile(maskFile);

// 2. Trace.
const svg = await new Promise((resolve, reject) =>
  potrace.trace(
    maskFile,
    { threshold: 128, turdSize: 40, alphaMax: ALPHA, optCurve: true, optTolerance: OPT },
    (err, traced) => (err ? reject(err) : resolve(traced)),
  ),
);
const d = /<path[^>]*\sd="([^"]+)"/.exec(svg)[1];

// 3. Contours, their boxes, the overall box; normalise to cap height 40 at y 4.
const subpaths = d
  .trim()
  .split(/(?=M)/)
  .map((s) => s.trim())
  .filter(Boolean);
const boxOf = (s) => {
  const n = s.match(/-?\d+(\.\d+)?/g).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};
const boxes = subpaths.map(boxOf);
const all = {
  minX: Math.min(...boxes.map((b) => b.minX)),
  maxX: Math.max(...boxes.map((b) => b.maxX)),
  minY: Math.min(...boxes.map((b) => b.minY)),
  maxY: Math.max(...boxes.map((b) => b.maxY)),
};
const scale = 40 / (all.maxY - all.minY);
// Compact syntax: no commas, no space after a command letter (potrace writes "M 4 5 C 3.2 5.3, …").
const compact = (s) =>
  s
    .replace(/,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/([MCLZ]) /g, '$1')
    .replace(/ ([MCLZ])/g, '$1')
    .trim();
const transform = (s) => {
  let i = 0;
  return compact(s).replace(/-?\d+(\.\d+)?/g, (n) => {
    const v = Number(n);
    const mapped = i % 2 === 0 ? (v - all.minX) * scale + 3 : (v - all.minY) * scale + 4;
    i++;
    return String(Math.round(mapped * 10) / 10);
  });
};

// 4. Outer contours are the ones no other contour contains; a hole goes with its outer.
const contains = (a, b) =>
  a.minX <= b.minX && a.maxX >= b.maxX && a.minY <= b.minY && a.maxY >= b.maxY;
const outer = boxes
  .map((_, i) => i)
  .filter((i) => !boxes.some((o, j) => j !== i && contains(o, boxes[i])))
  .sort((a, b) => boxes[a].minX - boxes[b].minX);
const glyphs = outer.map((i) => ({ parts: [subpaths[i]], box: boxes[i] }));
boxes.forEach((box, i) => {
  if (outer.includes(i)) return;
  (glyphs.find((g) => contains(g.box, box)) ?? glyphs[0]).parts.push(subpaths[i]);
});
if (glyphs.length !== 4)
  throw new Error(`expected the four letters, found ${glyphs.length} shapes`);

const width = Math.ceil((all.maxX - all.minX) * scale + 6);
const result = {
  source: path.basename(source),
  settings: { SCALE, BLUR, SAT, ALPHA, OPT },
  viewBox: `0 0 ${width} 48`,
  be: glyphs
    .slice(0, 2)
    .flatMap((g) => g.parts)
    .map(transform)
    .join(''),
  so: glyphs
    .slice(2)
    .flatMap((g) => g.parts)
    .map(transform)
    .join(''),
};
await writeFile(out, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `written ${path.relative(root, out)}: ${result.viewBox}, ${result.be.length + result.so.length} path characters`,
);
