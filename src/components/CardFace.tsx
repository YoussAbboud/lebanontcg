import type { Listing } from '../lib/types';
import { faceBackground, glyphOf } from '../lib/face';
import './cardface.css';

/**
 * A listing's visual: the cover photo when it has one, otherwise the
 * design component's per-id hue nebula with a giant Chakra glyph.
 */
export function CardFace({
  listing,
  className = '',
  glyphSize,
  onAcid = false,
}: {
  listing: Listing;
  className?: string;
  /** CSS font-size for the fallback glyph (e.g. '84px' or 'clamp(...)'). */
  glyphSize?: string;
  onAcid?: boolean;
}) {
  const cover = listing.images[0];
  return (
    <div
      className={`cardface ${className}`}
      style={cover ? undefined : { background: faceBackground(listing.id) }}
    >
      {cover ? (
        <img src={cover.url} alt="" loading="lazy" decoding="async" />
      ) : (
        <div
          className={`cardface-glyph ${onAcid ? 'cardface-glyph-acid' : ''}`}
          style={glyphSize ? { fontSize: glyphSize } : undefined}
          aria-hidden="true"
        >
          {glyphOf(listing.title)}
        </div>
      )}
    </div>
  );
}
