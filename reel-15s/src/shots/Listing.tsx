// S3 · Listing — the real listing page of the auction just opened (live, $304, 3 bids, ends in 3m): the camera glides
// from the photo down to the bid panel and holds so it reads (≥30f). No overlay text — the page is the content.
// Local timeline (abs = local + 251): 0–3 settle on the photo (S2's open lands here) · 3–30 glide · 30–59 hold.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, ramp } from '../fixtures/Polish';
import { ListingPage } from './Page';

export const LISTING_GLIDE = [3, 30] as const;
export const LISTING_END_SCROLL = 600; // CSS px: frame shows the title, the bid panel and the bid history
export const listingScroll = (f: number) => LISTING_END_SCROLL * ramp(f, LISTING_GLIDE[0], LISTING_GLIDE[1] - LISTING_GLIDE[0], EASE.smooth);

export const Listing: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <ListingPage scroll={listingScroll(frame)} />
    </AbsoluteFill>
  );
};
