// The publish gate, browser-side: does the report's front capture look
// like the listing's cover? The front capture is a FLATTENED card
// (corner-pinned), while listing covers usually still carry background —
// so the cover is compared both as-is and card-flattened (when its
// outline detects). Any variant within threshold passes; an honest
// seller must not be blocked by framing differences.

import { detectCardQuad } from './centering';
import { urlToRaster } from './decode';
import { aHash, hammingDistance, PHASH_MATCH_THRESHOLD } from './phash';
import { warpQuad, type Raster } from './raster';

function flattenIfDetected(img: Raster): Raster | null {
  const quad = detectCardQuad(img);
  if (!quad) return null;
  return warpQuad(img, quad.quad, 250, 350);
}

/** True when the capture and the cover plausibly show the same card. */
export async function capturesMatchCover(frontUrl: string, coverUrl: string): Promise<boolean> {
  const [front, cover] = await Promise.all([urlToRaster(frontUrl), urlToRaster(coverUrl)]);
  const frontHashes = [aHash(front)];
  const frontFlat = flattenIfDetected(front);
  if (frontFlat) frontHashes.push(aHash(frontFlat));
  const coverHashes = [aHash(cover)];
  const coverFlat = flattenIfDetected(cover);
  if (coverFlat) coverHashes.push(aHash(coverFlat));
  for (const f of frontHashes) {
    for (const c of coverHashes) {
      if (hammingDistance(f, c) <= PHASH_MATCH_THRESHOLD) return true;
    }
  }
  return false;
}
