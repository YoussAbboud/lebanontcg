// S3 · Steps — the camera pushes into the sheet's three steps (1 → 1.12, professional curve, 20 f). A reticle
// (effects/fui-hud-moves · reticle-lock-on) flies in from the bottom right, overshoots and bites step 1 on b14 with the
// label SHARE; the real step card lifts off the sheet (1.03×, accent outline) while the others dim. Each step holds a
// person's pace (≥43 f): step 2 on b17, step 3 on b20. The reticle is used once in the film, and it is drawn in a layer
// above the (clipped) screen so its dash starts outside the frame, not inside the window.
import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { HomePage, IOS, Overlay, SCREEN, Screen, Sheet, SheetPatch, centre, rectL } from '../Screen';
import { ReticleLayer } from './Reticle';

const SCREEN_W = SCREEN.w;
import { SHOTS, localBeat } from '../timing';
import { C, FONT, PRO } from '../theme';
import { EASE, SpeedBlur, mix, ramp } from '../fixtures/Polish';

export const PUSH = 1.12;
const STEP_AT = [localBeat(SHOTS.steps, 14), localBeat(SHOTS.steps, 17), localBeat(SHOTS.steps, 20)]; // 29, 72, 116
// the reticle's schedule keeps the demo's proportions (fly 10 f, shrink 26 f with the overshoot) and ends ON the beat
const BITE = STEP_AT[0]; // the bite frame (b14): settled on 1
const FLY_IN = BITE - 26;
const FLY_END = BITE - 16;
const SHRINK0 = BITE - 20;
const UNDER = BITE - 6; // 0.94× overshoot
const LOCK_END = BITE;
const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

/** The camera origin for the push: the centre of the three steps (screen-local px). */
export const stepsCentre = () => {
  const a = rectL(IOS.steps[0].box);
  const b = rectL(IOS.steps[2].box);
  return { x: a.x + a.w / 2, y: (a.y + b.y + b.h) / 2 };
};

export const Steps: React.FC = () => {
  const f = useCurrentFrame();
  const push = mix(1, PUSH, ramp(f, 0, 20, PRO));
  const o = stepsCentre();
  const active = f >= STEP_AT[2] ? 2 : f >= STEP_AT[1] ? 1 : f >= STEP_AT[0] ? 0 : -1;

  // reticle around step 1
  const target = rectL(IOS.steps[0].box);
  const tc = centre(target);
  const flyAt = (fr: number) => {
    const t = interpolate(fr, [FLY_IN, FLY_END], [0, 1], { easing: Easing.out(Easing.cubic), ...clamp });
    return { x: (1 - t) * 900, y: (1 - t) * 700 };
  };
  const fly = flyAt(f);
  const fly0 = flyAt(f - 0.5);
  const fly1 = flyAt(f + 0.5);
  const shrink = f < UNDER ? mix(2.2, 0.94, ramp(f, SHRINK0, UNDER - SHRINK0, EASE.swift)) : mix(0.94, 1, ramp(f, UNDER, LOCK_END - UNDER, EASE.out));
  const bite = interpolate(f, [BITE, BITE + 1, BITE + 5], [0, 1, 0], clamp);
  const PAD = 10;
  const hw = (target.w / 2 + PAD) * shrink - 5 * bite;
  const hh = (target.h / 2 + PAD) * shrink - 5 * bite;
  const retOp = interpolate(f, [FLY_IN, FLY_IN + 3, STEP_AT[1] - 6, STEP_AT[1]], [0, 1, 1, 0], clamp);
  const labelT = interpolate(f, [BITE + 2, BITE + 12], [0, 1], { easing: Easing.out(Easing.back(1.8)), ...clamp });
  const ARM = 34;
  const THICK = 4;
  const corners = [
    { x: tc.x - hw, y: tc.y - hh, sx: 1, sy: 1 },
    { x: tc.x + hw, y: tc.y - hh, sx: -1, sy: 1 },
    { x: tc.x - hw, y: tc.y + hh, sx: 1, sy: -1 },
    { x: tc.x + hw, y: tc.y + hh, sx: -1, sy: -1 },
  ];
  const stroke = (w: number, h: number, under: boolean): React.CSSProperties => ({
    position: 'absolute', left: under ? -2 : 0, top: under ? -2 : 0, width: w + (under ? 4 : 0), height: h + (under ? 4 : 0), borderRadius: 3,
    background: under ? 'rgba(8,9,11,0.9)' : C.accent,
  });

  const camera: React.CSSProperties = { position: 'absolute', inset: 0, transform: `scale(${push.toFixed(5)})`, transformOrigin: `${o.x.toFixed(1)}px ${o.y.toFixed(1)}px` };
  return (
    <>
    <Screen bar={1}>
      <div style={camera}>
        <HomePage />
        <Overlay opacity={1} />
        <Sheet variant="ios" />
        {/* the three real step cards: the active one lifts, the others dim */}
        {IOS.steps.map((s, i) => {
          const on = i === active;
          const since = on ? f - STEP_AT[i] : 0;
          const lift = on ? ramp(since, 0, 12, EASE.snappy) : 0;
          const dimT = active < 0 ? 0 : on ? 0 : 1;
          const dim = 0.45 * ramp(f, STEP_AT[Math.max(0, active)], 10, EASE.out) * dimT;
          const r = rectL(s.box);
          return (
            <SheetPatch
              key={i}
              variant="ios"
              rect={s.box}
              style={{
                borderRadius: 12 * 2.05,
                transform: `translateY(${(-4 * lift).toFixed(2)}px) scale(${(1 + 0.03 * lift).toFixed(4)})`,
                boxShadow: on
                  ? `0 0 0 ${(2 * lift).toFixed(2)}px ${C.accent}, 0 ${18 * lift}px ${40 * lift}px -10px rgba(0,0,0,${(0.6 * lift).toFixed(2)})`
                  : 'none',
              }}
            >
              {dim > 0 && <div style={{ position: 'absolute', inset: 0, background: `rgba(8,9,11,${dim.toFixed(3)})` }} />}
              {/* keep the lifted card's own corner radius: nothing else */}
              <div style={{ position: 'absolute', inset: 0, width: r.w, height: r.h }} />
            </SheetPatch>
          );
        })}
        {/* the bite label: a dark capsule above step 1's right end (back ease, overshoot), with the reticle only */}
        {active === 0 && (() => {
          const r = rectL(IOS.steps[0].box);
          const t = labelT;
          return (
            <div
              style={{
                position: 'absolute', right: SCREEN_W - (r.x + r.w - 6), top: r.y - 52, transform: `scale(${t.toFixed(3)})`, transformOrigin: '100% 100%', opacity: Math.min(1, t * 1.5),
                display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', padding: '8px 14px 8px 12px', borderRadius: 10,
                background: 'linear-gradient(180deg, #23272e 0%, #15181d 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 1px rgba(0,0,0,0.4), 0 12px 24px -8px rgba(0,0,0,0.6)',
                fontFamily: FONT.mono, fontWeight: 700, fontSize: 30, letterSpacing: '0.12em', color: C.ink,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 5, background: C.accent, boxShadow: `0 0 0 4px rgba(211,252,59,0.22)` }} />
              SHARE
              <span style={{ fontWeight: 500, fontSize: 26, color: 'rgba(255,255,255,0.6)', padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.07)' }}>1/3</span>
            </div>
          );
        })()}
      </div>
    </Screen>
    {/* the reticle, above the screen and unclipped: same camera, no overflow */}
    {f >= FLY_IN && retOp > 0 && (
      <ReticleLayer camera={camera}>
        <SpeedBlur vx={fly1.x - fly0.x} vy={fly1.y - fly0.y} amount={0.3} max={22}>
          <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${fly.x.toFixed(2)}px, ${fly.y.toFixed(2)}px)`, opacity: retOp }}>
            {corners.map((c, i) => (
              <div key={i} style={{ position: 'absolute', left: c.x, top: c.y, transform: `scale(${c.sx}, ${c.sy})`, transformOrigin: '0 0' }}>
                <div style={stroke(ARM, THICK, true)} />
                <div style={stroke(THICK, ARM, true)} />
                <div style={stroke(ARM, THICK, false)} />
                <div style={stroke(THICK, ARM, false)} />
              </div>
            ))}
          </div>
        </SpeedBlur>
      </ReticleLayer>
    )}
    </>
  );
};
