// LebanonTCG tokens (src/styles/tokens.css of the product) — the film's only palette.
export const C = {
  bg: '#08090b',
  frame: '#0e1013',
  panel: '#16191e',
  ink: '#f2f5f7',
  ink2: '#b9c2cc',
  muted: '#7b8590',
  acid: '#d6ff3f',
  onAcid: '#08090b',
  violet: '#7b5cff',
  cyan: '#35e4ff',
  online: '#34d399',
  pink: '#ff5c8a',
  line: 'rgba(255,255,255,0.08)',
} as const;
export const GRADIENT = `linear-gradient(90deg, ${C.violet} 0%, ${C.cyan} 50%, ${C.acid} 100%)`;
