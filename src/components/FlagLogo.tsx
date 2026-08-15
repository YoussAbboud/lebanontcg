import './flaglogo.css';

/**
 * Brand mark (R5): the Lebanese flag as a gold-bordered trading card,
 * drawn inline so it needs no asset. A slow holo shine sweeps across it,
 * echoing the animated logo gif.
 */
export function FlagLogo({ size = 34 }: { size?: number }) {
  const w = Math.round(size * (5 / 7));
  return (
    <span className="flaglogo" style={{ width: w, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 140" width={w} height={size} role="img" aria-label="LebanonTCG">
        {/* gold slab frame */}
        <rect x="2" y="2" width="96" height="136" rx="14" fill="var(--flag-gold)" />
        <rect x="7" y="7" width="86" height="126" rx="10" fill="var(--flag-white)" />
        {/* flag bands */}
        <path d="M9 17 a8 8 0 0 1 8 -8 h66 a8 8 0 0 1 8 8 v23 H9 Z" fill="var(--flag-red)" />
        <rect x="9" y="40" width="82" height="60" fill="var(--flag-white)" />
        <path d="M9 100 h82 v23 a8 8 0 0 1 -8 8 H17 a8 8 0 0 1 -8 -8 Z" fill="var(--flag-red)" />
        {/* cedar */}
        <g fill="var(--flag-green)">
          <path d="M50 44 L57 55 L52.5 54.5 L60 65 L54 64.5 L63 75 L55.5 74 L64.5 84 L53 82.5 L53 88 L47 88 L47 82.5 L35.5 84 L44.5 74 L37 75 L46 64.5 L40 65 L47.5 54.5 L43 55 Z" />
          <rect x="47.5" y="86" width="5" height="8" rx="1.5" />
          <path d="M36 93 q14 -5 28 0 l-1.5 4 q-12.5 -4.5 -25 0 Z" />
        </g>
      </svg>
      <span className="flaglogo-shine" />
    </span>
  );
}
