/** The tier and accent colours, as tokens, so the confetti follows the theme. */
const COLOURS = [
  'var(--badge-gold-foreground)',
  'var(--primary)',
  'var(--like)',
  'var(--badge-platinum-foreground)',
  'var(--badge-bronze-foreground)',
];
const PIECES = 42;
const LASTS_MS = 1800;

/**
 * A short burst of confetti over the page for a badge that just arrived (ADR 0021, "Rewards").
 * Plain DOM, no React: the toast that calls it is imperative too. Nothing with reduced motion.
 */
export function celebrate(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.className = 'confetti';
  for (let i = 0; i < PIECES; i += 1) {
    const piece = document.createElement('span');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = COLOURS[i % COLOURS.length] ?? 'var(--primary)';
    piece.style.animationDelay = `${Math.round(Math.random() * 250)}ms`;
    piece.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 240)}px`);
    piece.style.setProperty('--spin', `${Math.round(Math.random() * 720 - 360)}deg`);
    layer.append(piece);
  }
  document.body.append(layer);
  window.setTimeout(() => layer.remove(), LASTS_MS);
}
