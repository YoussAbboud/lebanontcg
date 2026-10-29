// S4 · Android — the same camera; the iOS sheet crossfades (8 f) to the Android sheet with its one-tap button, and a
// fingertip taps it on b23 (the real button presses to 0.97× for 4 f).
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { ANDROID, HomePage, IOS, Overlay, Screen, Sheet, SheetPatch, TapRing, centre, rectL } from '../Screen';
import { SHOTS, localBeat } from '../timing';
import { EASE, ramp } from '../fixtures/Polish';
import { PUSH, stepsCentre } from './Steps';

export const TAP = localBeat(SHOTS.android, 24); // 15

export const Android: React.FC = () => {
  const f = useCurrentFrame();
  const x = ramp(f, 0, 8, EASE.smooth);
  const o = stepsCentre();
  const btn = rectL(ANDROID.install);
  const bc = centre(btn);
  const press = f >= TAP && f < TAP + 4 ? 0.97 : f >= TAP + 4 && f < TAP + 10 ? 0.97 + 0.03 * ramp(f, TAP + 4, 6, EASE.out) : 1;
  return (
    <Screen>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${PUSH})`, transformOrigin: `${o.x.toFixed(1)}px ${o.y.toFixed(1)}px` }}>
        <HomePage />
        <Overlay opacity={1} />
        <Sheet variant="ios" opacity={1 - x} dy={x * (rectL(ANDROID.box).y - rectL(IOS.box).y)} />
        <Sheet variant="android" opacity={x} dy={(x - 1) * (rectL(ANDROID.box).y - rectL(IOS.box).y)} />
        {x >= 0.999 && (
          <SheetPatch variant="android" rect={ANDROID.install} style={{ borderRadius: 999, transform: `scale(${press.toFixed(3)})` }} />
        )}
        <TapRing x={bc.x} y={bc.y} at={TAP} frame={f} color="#08090b" rim="rgba(211,252,59,0.9)" />
      </div>
    </Screen>
  );
};
