/**
 * The ready-made profile pictures (`pnpm presets`): avatars and covers a member can pick instead
 * of uploading a photo, some of them unlocked by badges (ADR 0021, "Rewards"). Writes
 * `apps/api/presets/avatar-<id>.webp` (512 × 512) and `cover-<id>.webp` (1800 × 600), which the
 * API serves under `/uploads/preset/`; the catalogue (ids, unlocks) is
 * `packages/shared/src/pictures.ts`, and every id there must have its file here.
 *
 * Avatars: `scripts/presets/avatars/*.svg`, Open Peeps by Pablo Stanley (CC0 1.0, the licence
 * is in each file's metadata), generated once with DiceBear 9.4 (`@dicebear/open-peeps`, chosen
 * head, face, skin, accessories and background per avatar) in a throwaway install, like the
 * wordmark trace; the SVGs are the source, nothing of DiceBear is a dependency. Covers are drawn
 * below in the brand's colours, so no licence applies to them.
 *
 * Rendering uses the API's `sharp`, as `pnpm brand` does. `--preview <file.png>` also writes a
 * sheet of everything.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'apps/api/package.json'));
const sharp = require('sharp');

const AVATARS = path.join(root, 'scripts/presets/avatars');
const OUT = path.join(root, 'apps/api/presets');
const W = 1800;
const H = 600;

/** Deterministic randomness, so a cover is the same on every run. */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const svg = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`;
const linear = (id, stops, [x1, y1, x2, y2] = [0, 0, 0, 1]) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`)
    .join('')}</linearGradient>`;

/** A smooth band across the width: `amp` high, `waves` crests, its top at `y`, filled below. */
function hill(y, amp, waves, phase, color) {
  const points = [];
  for (let x = 0; x <= W; x += 30) {
    points.push(`${x},${(y + Math.sin((x / W) * Math.PI * 2 * waves + phase) * amp).toFixed(1)}`);
  }
  return `<path d="M0,${H} L${points.join(' L')} L${W},${H} Z" fill="${color}"/>`;
}

function stars(seed, count, color, maxRadius) {
  const next = random(seed);
  return Array.from({ length: count }, () => {
    const r = (0.6 + next() * maxRadius).toFixed(1);
    const o = (0.35 + next() * 0.65).toFixed(2);
    return `<circle cx="${(next() * W).toFixed(0)}" cy="${(next() * H * 0.9).toFixed(0)}" r="${r}" fill="${color}" opacity="${o}"/>`;
  }).join('');
}

/** A four-pointed sparkle. */
const sparkle = (x, y, size, color) =>
  `<path d="M${x},${y - size} Q${x + size * 0.18},${y - size * 0.18} ${x + size},${y} Q${x + size * 0.18},${y + size * 0.18} ${x},${y + size} Q${x - size * 0.18},${y + size * 0.18} ${x - size},${y} Q${x - size * 0.18},${y - size * 0.18} ${x},${y - size} Z" fill="${color}"/>`;

const COVERS = {
  // Free for everyone.
  dawn: () =>
    svg(
      `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="1320" cy="250" r="110" fill="#fff4e0" opacity="0.9"/>${hill(380, 40, 1.2, 0.5, '#f2b8a2')}${hill(440, 35, 1.6, 2, '#e79a8c')}${hill(510, 25, 2, 4, '#c77f8f')}`,
      linear('sky', [
        [0, '#fde3cf'],
        [1, '#ddd2f5'],
      ]),
    ),
  ocean: () =>
    svg(
      `<rect width="${W}" height="${H}" fill="url(#sea)"/>${hill(260, 22, 2.2, 0, '#9cc2ec')}${hill(340, 26, 1.8, 1.4, '#6fa3de')}${hill(420, 30, 2.6, 3, '#3f7fc7')}${hill(500, 24, 2, 5, '#285e9f')}`,
      linear('sea', [
        [0, '#e3effb'],
        [1, '#b9d4f2'],
      ]),
    ),
  meadow: () =>
    svg(
      `<rect width="${W}" height="${H}" fill="url(#air)"/>${hill(330, 45, 1, 1, '#b9e3c6')}${hill(400, 40, 1.4, 3, '#86cf9f')}${hill(470, 30, 1.9, 0.3, '#56b07a')}${hill(540, 18, 2.4, 2, '#3b8f5d')}`,
      linear('air', [
        [0, '#f2fbf5'],
        [1, '#d4efe0'],
      ]),
    ),
  mesh: () =>
    svg(
      `<rect width="${W}" height="${H}" fill="#2a2f55"/><rect width="${W}" height="${H}" fill="url(#a)"/><rect width="${W}" height="${H}" fill="url(#b)"/><rect width="${W}" height="${H}" fill="url(#c)"/>`,
      `<radialGradient id="a" cx="0.18" cy="0.25" r="0.6"><stop offset="0" stop-color="#3a8fe0" stop-opacity="0.95"/><stop offset="1" stop-color="#3a8fe0" stop-opacity="0"/></radialGradient><radialGradient id="b" cx="0.8" cy="0.15" r="0.5"><stop offset="0" stop-color="#9a5ee0" stop-opacity="0.6"/><stop offset="1" stop-color="#9a5ee0" stop-opacity="0"/></radialGradient><radialGradient id="c" cx="0.7" cy="0.9" r="0.6"><stop offset="0" stop-color="#36c2c9" stop-opacity="0.7"/><stop offset="1" stop-color="#36c2c9" stop-opacity="0"/></radialGradient>`,
    ),
  paper: () => {
    const dots = [];
    for (let x = 30; x < W; x += 40) {
      for (let y = 30; y < H; y += 40)
        dots.push(`<circle cx="${x}" cy="${y}" r="2.2" fill="#ddd1bb"/>`);
    }
    return svg(
      `<rect width="${W}" height="${H}" fill="#f7f2e8"/>${dots.join('')}<circle cx="1490" cy="190" r="90" fill="#f2c572" opacity="0.8"/><circle cx="1600" cy="300" r="60" fill="#e98c7a" opacity="0.7"/><circle cx="1390" cy="330" r="40" fill="#7fb0e3" opacity="0.8"/>`,
    );
  },
  citrus: () => {
    const bands = ['#ffe48a', '#ffd56b', '#ffb85c', '#ff9a6a', '#f57f7f', '#ffe48a'];
    // Wider than the cover once turned, so no corner is left uncovered.
    return svg(
      `<rect width="${W}" height="${H}" fill="#ffe48a"/>${bands
        .map(
          (color, i) =>
            `<rect x="${-900 + i * 560}" y="-900" width="560" height="2400" fill="${color}" transform="rotate(24 900 300)"/>`,
        )
        .join('')}`,
    );
  },

  // Unlocked by badges (pictures.ts says which).
  'night-sky': () =>
    svg(
      `<rect width="${W}" height="${H}" fill="url(#night)"/>${stars(7, 220, '#ffffff', 1.8)}<circle cx="1450" cy="170" r="80" fill="#fdf3c7"/><circle cx="1485" cy="145" r="72" fill="#1c2147"/>${hill(520, 22, 1.5, 1, '#121634')}`,
      linear('night', [
        [0, '#101436'],
        [1, '#2d3570'],
      ]),
    ),
  sunrise: () => {
    const rays = Array.from({ length: 18 }, (_, i) => {
      const angle = Math.PI + (i / 17) * Math.PI;
      const x = 900 + Math.cos(angle) * 1400;
      const y = 470 + Math.sin(angle) * 1400;
      return `<line x1="900" y1="470" x2="${x.toFixed(0)}" y2="${y.toFixed(0)}" stroke="#fff0c9" stroke-width="26" opacity="0.35"/>`;
    }).join('');
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#morning)"/>${rays}<circle cx="900" cy="470" r="160" fill="#ffe39a"/>${hill(470, 12, 1.2, 0, '#f28b6e')}${hill(520, 14, 1.8, 2, '#d9667a')}`,
      linear('morning', [
        [0, '#ffb6a0'],
        [1, '#ffd7a8'],
      ]),
    );
  },
  darkroom: () => {
    const holes = [];
    for (let x = 20; x < W; x += 60) {
      holes.push(`<rect x="${x}" y="118" width="30" height="20" rx="4" fill="#26262b"/>`);
      holes.push(`<rect x="${x}" y="462" width="30" height="20" rx="4" fill="#26262b"/>`);
    }
    const frames = Array.from(
      { length: 6 },
      (_, i) =>
        `<rect x="${40 + i * 300}" y="160" width="260" height="280" rx="10" fill="url(#print)" opacity="${0.75 + (i % 3) * 0.08}"/>`,
    ).join('');
    return svg(
      `<rect width="${W}" height="${H}" fill="#151517"/><rect width="${W}" height="${H}" fill="url(#safelight)"/><rect y="100" width="${W}" height="400" fill="#3a3a40"/>${holes.join('')}${frames}`,
      `<radialGradient id="safelight" cx="0.85" cy="0.1" r="0.7"><stop offset="0" stop-color="#d0342c" stop-opacity="0.55"/><stop offset="1" stop-color="#d0342c" stop-opacity="0"/></radialGradient>${linear(
        'print',
        [
          [0, '#6b6b75'],
          [1, '#a6a2a8'],
        ],
        [0, 0, 1, 1],
      )}`,
    );
  },
  confetti: () => {
    const next = random(25);
    const colors = ['#f57f7f', '#ffcf5c', '#78d08d', '#6fb3ec', '#b28ef0', '#ff9fd0'];
    const pieces = Array.from({ length: 170 }, () => {
      const x = (next() * W).toFixed(0);
      const y = (next() * H).toFixed(0);
      const color = colors[Math.floor(next() * colors.length)];
      const turn = (next() * 180).toFixed(0);
      return next() < 0.35
        ? `<circle cx="${x}" cy="${y}" r="${(5 + next() * 6).toFixed(1)}" fill="${color}"/>`
        : `<rect x="${x}" y="${y}" width="${(10 + next() * 12).toFixed(0)}" height="${(5 + next() * 5).toFixed(0)}" rx="2" fill="${color}" transform="rotate(${turn} ${x} ${y})"/>`;
    }).join('');
    return svg(`<rect width="${W}" height="${H}" fill="#fdf8ef"/>${pieces}`);
  },
  topography: () => {
    const rings = [];
    for (const [cx, cy, count, seed] of [
      [430, 250, 11, 3],
      [1350, 380, 13, 9],
    ]) {
      const next = random(seed);
      const wobble = Array.from({ length: 5 }, () => next() * Math.PI * 2);
      for (let i = 1; i <= count; i += 1) {
        const points = [];
        for (let a = 0; a <= 64; a += 1) {
          const t = (a / 64) * Math.PI * 2;
          const r =
            i * 38 * (1 + 0.12 * Math.sin(3 * t + wobble[0]) + 0.08 * Math.sin(5 * t + wobble[1]));
          points.push(
            `${(cx + Math.cos(t) * r * 1.35).toFixed(1)},${(cy + Math.sin(t) * r).toFixed(1)}`,
          );
        }
        rings.push(
          `<polyline points="${points.join(' ')}" fill="none" stroke="#5f8f6b" stroke-width="${i % 4 === 0 ? 2.6 : 1.4}" opacity="0.55"/>`,
        );
      }
    }
    return svg(`<rect width="${W}" height="${H}" fill="#e9efdc"/>${rings.join('')}`);
  },
  gold: () => {
    const next = random(50);
    const glints = Array.from({ length: 26 }, () =>
      sparkle(
        Math.round(next() * W),
        Math.round(next() * H),
        Math.round(8 + next() * 22),
        next() < 0.5 ? '#fff6d6' : '#ffe9a3',
      ),
    ).join('');
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#gold)"/>${glints}`,
      linear(
        'gold',
        [
          [0, '#a8741a'],
          [0.45, '#e9c15a'],
          [0.7, '#f7df8e'],
          [1, '#c9952c'],
        ],
        [0, 0, 1, 1],
      ),
    );
  },
};

async function main() {
  await mkdir(OUT, { recursive: true });
  const written = [];
  for (const file of (await readdir(AVATARS)).filter((name) => name.endsWith('.svg')).toSorted()) {
    const id = path.basename(file, '.svg');
    const target = path.join(OUT, `avatar-${id}.webp`);
    // oxlint-disable-next-line no-await-in-loop -- a couple of dozen files, one at a time
    await sharp(await readFile(path.join(AVATARS, file)))
      .resize(512, 512)
      .webp({ quality: 86 })
      .toFile(target);
    written.push(target);
  }
  for (const [id, draw] of Object.entries(COVERS)) {
    const target = path.join(OUT, `cover-${id}.webp`);
    // oxlint-disable-next-line no-await-in-loop
    await sharp(Buffer.from(draw())).webp({ quality: 88 }).toFile(target);
    written.push(target);
  }
  console.log(`Wrote ${written.length} pictures to ${path.relative(root, OUT)}`);

  const previewAt = process.argv.indexOf('--preview');
  if (previewAt !== -1 && process.argv[previewAt + 1]) {
    const avatars = written.filter((file) => path.basename(file).startsWith('avatar-'));
    const covers = written.filter((file) => path.basename(file).startsWith('cover-'));
    const tile = 120;
    const coverW = 600;
    const coverH = 200;
    const width = Math.max(8 * tile, 3 * coverW);
    const height = Math.ceil(avatars.length / 8) * tile + Math.ceil(covers.length / 3) * coverH;
    const composites = [
      ...(await Promise.all(
        avatars.map(async (file, i) => ({
          input: await sharp(file)
            .resize(tile - 8, tile - 8)
            .png()
            .toBuffer(),
          left: (i % 8) * tile + 4,
          top: Math.floor(i / 8) * tile + 4,
        })),
      )),
      ...(await Promise.all(
        covers.map(async (file, i) => ({
          input: await sharp(file)
            .resize(coverW - 8, coverH - 8)
            .png()
            .toBuffer(),
          left: (i % 3) * coverW + 4,
          top: Math.ceil(avatars.length / 8) * tile + Math.floor(i / 3) * coverH + 4,
        })),
      )),
    ];
    await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
      .composite(composites)
      .png()
      .toFile(process.argv[previewAt + 1]);
  }
}

await main();
