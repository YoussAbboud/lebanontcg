import type { Condition, Finish, Game } from '../lib/types';

// Procedurally drawn placeholder card images for mock mode — no downloaded
// assets. Each image is a stylized card back color-coded by game, with a
// deterministic pattern derived from the seed string, so every listing keeps
// a stable, distinct image across reloads.

const GAME_HUES: Record<Game, { bg: string; accent: string; deep: string }> = {
  pokemon: { bg: '#8a6a12', accent: '#ffcb3d', deep: '#4d3a08' },
  magic: { bg: '#7c3d16', accent: '#e77b3a', deep: '#431f09' },
  yugioh: { bg: '#4c2d78', accent: '#a06be0', deep: '#291845' },
  onepiece: { bg: '#7c1f2c', accent: '#e0485a', deep: '#420f17' },
  lorcana: { bg: '#1e3f6e', accent: '#5aa7ff', deep: '#0f2138' },
  other: { bg: '#3d4048', accent: '#8a8d96', deep: '#22242a' },
};

/** Small deterministic PRNG (mulberry32) seeded from a string. */
function rng(seed: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CardArtOptions {
  game: Game;
  seed: string;
  finish?: Finish;
  condition?: Condition;
  width?: number;
}

/**
 * Draws a card-back style placeholder and returns it as a data URL (browser)
 * — 5:7 aspect like a real TCG card.
 */
export function drawCardImage(opts: CardArtOptions): string {
  const w = opts.width ?? 500;
  const h = Math.round((w * 7) / 5);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const { bg, accent, deep } = GAME_HUES[opts.game];
  const rand = rng(opts.seed);

  // Ground
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, deep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Pattern layer: diagonal lattice of shapes, deterministic per seed
  const shapeCount = 26 + Math.floor(rand() * 14);
  for (let i = 0; i < shapeCount; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 8 + rand() * (w * 0.09);
    ctx.globalAlpha = 0.05 + rand() * 0.12;
    ctx.fillStyle = rand() > 0.5 ? accent : '#ffffff';
    const kind = Math.floor(rand() * 3);
    ctx.beginPath();
    if (kind === 0) {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    } else if (kind === 1) {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
    } else {
      ctx.rect(x - r / 2, y - r / 2, r, r);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Foil sheen for holo-ish finishes (quotes R3's spectrum sheen)
  if (opts.finish && opts.finish !== 'normal' && opts.finish !== 'other') {
    const sheen = ctx.createLinearGradient(0, h, w, 0);
    sheen.addColorStop(0, 'rgba(138, 92, 255, 0.20)');
    sheen.addColorStop(0.5, 'rgba(225, 79, 255, 0.16)');
    sheen.addColorStop(1, 'rgba(255, 138, 76, 0.20)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);
  }

  // Inner frame — classic card-back border
  const m = w * 0.06;
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = Math.max(3, w * 0.012);
  roundRect(ctx, m, m, w - m * 2, h - m * 2, w * 0.05);
  ctx.stroke();
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = Math.max(2, w * 0.006);
  roundRect(ctx, m * 1.9, m * 1.9, w - m * 3.8, h - m * 3.8, w * 0.04);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Center emblem: concentric diamond
  const cx = w / 2;
  const cy = h / 2;
  const er = w * 0.2;
  for (let ring = 3; ring >= 1; ring--) {
    const rr = (er * ring) / 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - rr);
    ctx.lineTo(cx + rr, cy);
    ctx.lineTo(cx, cy + rr);
    ctx.lineTo(cx - rr, cy);
    ctx.closePath();
    ctx.fillStyle = ring % 2 === 0 ? accent : deep;
    ctx.globalAlpha = ring === 3 ? 0.9 : 1;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Wear marks for played conditions
  const wear =
    opts.condition === 'HP' || opts.condition === 'DMG' ? 22 : opts.condition === 'MP' ? 10 : 0;
  for (let i = 0; i < wear; i++) {
    ctx.globalAlpha = 0.10 + rand() * 0.12;
    ctx.fillStyle = '#ffffff';
    const edge = Math.floor(rand() * 4);
    const along = rand();
    const size = 3 + rand() * 9;
    const px = edge === 0 ? along * w : edge === 1 ? w - rand() * m : edge === 2 ? along * w : rand() * m;
    const py = edge === 0 ? rand() * m : edge === 1 ? along * h : edge === 2 ? h - rand() * m : along * h;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  return canvas.toDataURL('image/jpeg', 0.85);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const artCache = new Map<string, string>();

/** Cached wrapper — mock listings resolve their images through this. */
export function cardImageUrl(opts: CardArtOptions): string {
  const key = `${opts.game}|${opts.seed}|${opts.finish ?? ''}|${opts.condition ?? ''}|${opts.width ?? 500}`;
  let url = artCache.get(key);
  if (!url) {
    url = drawCardImage(opts);
    artCache.set(key, url);
  }
  return url;
}

/** Procedural avatar: initial on a game-hued disc. */
export function avatarDataUrl(seedName: string, size = 128): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = rng(seedName);
  const games = Object.keys(GAME_HUES) as Game[];
  const hue = GAME_HUES[games[Math.floor(rand() * games.length)]];
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, hue.accent);
  grad.addColorStop(1, hue.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(16, 17, 19, 0.85)';
  ctx.font = `800 ${size * 0.44}px Archivo, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(seedName.charAt(0).toUpperCase(), size / 2, size / 2 + size * 0.02);
  return canvas.toDataURL('image/png');
}
