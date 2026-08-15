// Per-id procedural "nebula" faces + acid-card picking, lifted verbatim
// from the Sleeved design component. Any listing without photos renders a
// hue face with a giant glyph; every acidEvery-th card (by id hash) flips
// to the acid gradient.

export function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function hueOf(id: string): number {
  return (hashId(id) * 137) % 360;
}

export const ACID_EVERY = 4;

export function isAcid(id: string): boolean {
  return hashId(id) % ACID_EVERY === 0;
}

/** CSS background for the nebula face. */
export function faceBackground(id: string): string {
  const u = hueOf(id);
  return (
    `radial-gradient(90% 70% at 30% 15%, hsl(${u} 70% 44% / .9), transparent 65%), ` +
    `linear-gradient(155deg, hsl(${(u + 40) % 360} 55% 22%), #0B0D10 70%)`
  );
}

/** Darker variant used for small thumbs (inbox rows, thread header). */
export function thumbBackground(seed: string): string {
  return `linear-gradient(155deg, hsl(${hashId(seed) % 360} 55% 30%), #0B0D10)`;
}

/** Avatar disc gradient for profiles without an image. */
export function avatarBackground(seed: string): string {
  return `linear-gradient(140deg, hsl(${hueOf(seed) % 360} 65% 52%), #16191E)`;
}

/** Small seller identity dot on cards. */
export function sellerDotBackground(seed: string): string {
  return `linear-gradient(140deg, hsl(${hashId(seed) % 360} 70% 55%), #35E4FF)`;
}

export function glyphOf(title: string): string {
  const ch = title.trim().charAt(0);
  return ch ? ch.toUpperCase() : '?';
}
