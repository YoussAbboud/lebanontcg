// S2 · Sheet — the site's own motion: the backdrop dims (0.78) and the sheet rises on the product's curve
// cubic-bezier(0.2, 0.9, 0.3, 1) over 0.42 s (13 f), landing on the drop (b8). Then it holds to be read.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { HomePage, IOS, Overlay, rectL, Screen, Sheet } from '../Screen';
import { SHOTS, localBeat } from '../timing';
import { EASE, bezier, ramp } from '../fixtures/Polish';

export const SHEET_EASE = bezier(0.2, 0.9, 0.3, 1); // the sheet's CSS animation curve (src/components/addtohome.css)
export const SHEET_RISE_F = 13; // 0.42 s
export const LAND = localBeat(SHOTS.sheet, 8); // 29

export const SheetRise: React.FC = () => {
  const f = useCurrentFrame();
  const dim = ramp(f, 0, 12, EASE.out);
  const p = ramp(f, LAND - SHEET_RISE_F, SHEET_RISE_F, SHEET_EASE);
  const h = rectL(IOS.box).h;
  return (
    <Screen bar={1}>
      <HomePage />
      <Overlay opacity={dim} />
      <Sheet variant="ios" dy={(1 - p) * h} />
    </Screen>
  );
};
