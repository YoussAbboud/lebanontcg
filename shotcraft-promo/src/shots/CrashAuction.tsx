// crash-zoom 急推（回弹款，第二轮重设计）——真实 projects 页全景一拍砸到 card4 特写。
// 手法不变：全景 hold → 预备回拉 → 6f 强 ease-in 急推（速度峰值落在到位帧）→ 一次可见过冲回弹落定。
//
// 设计决定
// - look：ember（暖黑 + 橙）。截图本身是暖白纸色页面，放进暖黑舞台里像一块被聚光灯打亮的屏幕：
//   全景是"产品摆在舞台上"——浏览器窗口微微后仰（rotateX 11°）、背后一圈橙色背光勾出轮廓、
//   脚下地面反光；急推同时把后仰拉正，到位就是正视特写（Q6：要读的卡片正视）。
// - 预告目标：急推前一拍，四只橙色角标从大框收拢锁定 card4（"看这个"先在全景里被点名），
//   角标挂在页面坐标里，急推后自然变成特写卡的取景框——全景到特写是同一条视线。
// - 落定：周边页面压成暖黑（聚光），目标卡浮起 + 橙色轮廓光；到位帧一记暖色曝光闪（8f 衰减）。
//   随后相机做一次"跟随"——平滑左移把卡让到左侧黄金位，右栏落一组大号读数（配套文案，虚构数据）。
// - 截图纹理保留（Q1：产品既有页面）；card4 用 4x 高清纹理覆盖原位，特写不糊字（Q2）。
//
// 时间表（30fps，132f）
//   0–34   全景 hold：窗口已在画面，后仰 13°→11°、zoom 0.70→0.72 极缓推近（smooth，机位活着但不晃）
//   14–30  锁定：四角标从外扩 150px 收拢到卡外 14px（snappy 16f），4f 显影
//   34–40  预备：zoom 回退 ~4%、后仰加深 1.5°，角标同步外扩一呼吸（蓄力）
//   40–46  急推 6f：log 空间强 ease-in 0.69→2.48，后仰同曲线归零，目标卡屏幕位置单调收向画面中心
//          ——只这一段加时间采样运动模糊（快门 ≈200°，子帧间距 ≤6px、上限 44，每层按间距补微模糊抹平回波）
//   46–58  回弹：阻尼余弦 2.48→2.34，一次可见回弹、微下冲收干；到位帧起暖色曝光闪 8f 衰减
//   47–64  点名：周边压暗到 86%（暖黑）、卡片浮起 + 轮廓光（out 曲线 16f）
//   56–78  跟随：相机平滑左移 320px（swift 22f），卡落到左侧黄金位
//   68–108 右栏读数：眉题 → 大数字逐字从线下升起 → 发丝线 → 两行说明（错峰 3–4f）；
//          右栏压暗的起点跟着卡片右缘走，不压到主角
//   108–131 hold 24f：极缓推近 1→1.015 + 光的呼吸，尾帧是一张完整海报
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import layout from '../live-layout.json';
import { Dust, LOOKS, Stage, TextReveal, alpha, type } from '../fixtures/Look';
import { EASE, FONT, Vignette, mix, ramp, softShadow } from '../fixtures/Polish';
import { C } from '../theme';
import { Fmt, useFmt } from '../fmt';

// LebanonTCG adaptation: the target is the live auction panel of the Umbreon listing, captured right after a bid in the
// final minute (history shows "+60s — bid in the final minute.", clock 1m 37s). The panel is wider than the demo's card,
// so REST/PEAK are rescaled to give it the same screen share; the window is the site's own dark frame.
// Look moved from ember to the product's graphite + acid (backlight = the brand violet). Timings are the demo's minus 2f
// so the hit lands on b38 — the strongest kick near the shot (slam #1). Slot is 159f (b35→b46); the tail hold is longer.
// Readout copy = the Terms sentence, split: "+60s" / "bid in the final minute" / "extends the clock so nobody is sniped."
export const CRASHZOOM_DUR = 159;

const L = LOOKS.ltcg;
const CARD = layout.listing.panel;
const TARGET = { cx: CARD.x + CARD.w / 2, cy: CARD.y + CARD.h / 2 }; // ≈ (960, 772) 页面坐标
const CARD_R = 16; // panel radius on the page (px)

// 浏览器窗口在页面坐标里的取景（页面 1920 宽，内容区 408–1512）：左右各留一截页边，
// 底边取到 1060 —— 特写时窗口下沿必须在画外（2.34x 下约落在屏幕 y≈1220）
const WIN = { x: 240, y: 0, w: 1440, h: 1060 };
const CHROME = 54; // 窗口标题栏高（页面 px）
const WIN_R = 18;
const WIN_C = { x: WIN.x + WIN.w / 2, y: (WIN.y - CHROME + WIN.y + WIN.h) / 2 }; // 窗口几何中心

const PUSH = 38; // crash start
const HIT = 44; // hit frame (6f crash)
// The slot starts at b35 (frame 509); entering the demo timeline one frame in puts HIT on 509 + 43 = 552 = b38, the
// strongest kick near the shot (b39, where it landed before, is a weak one). Pre-push wide hold stays 37f (card: ≥30f).
export const LEAD = 1;
// vertical: the panel must fit 1080 wide (784 × 1.28 ≈ 1003px) and follows UP instead of left, the readout below it
const restFor = (v: boolean) => (v ? 1.28 : 1.46); // panel ≈ 1145×557 on screen (landscape)
const SHIFT = 54; // follow start
const CARD_X_END = 650; // landscape: panel centre x after the follow-left
const CARD_Y_END_V = 640; // vertical: panel centre y after the follow-up

// 相机：zoom（页面 px → 屏幕 px）、目标卡中心的屏幕位置 sx/sy、后仰角 tilt。
// 用"目标卡屏幕位置"而不是相机中心做插值：急推时目标单调地收向画面中心，不会先甩出去再回来。
const camAt = (f: number, fmt: Fmt) => {
  const { W, H, v } = fmt;
  const REST = restFor(v);
  const PEAK = REST * 1.06; // +6% overshoot, the card's upper bound
  const settle = ramp(f, 0, 32, EASE.smooth);
  const wind = ramp(f, 32, 6, EASE.smooth);
  const z0 = mix(0.7, 0.72, settle) * mix(1, 0.96, wind);
  const tilt0 = mix(13, 11, settle) + 1.5 * wind;
  // 全景下目标卡的屏幕位置（窗口几何中心 → 屏幕中心）
  const wideSx = W / 2 + (TARGET.cx - WIN_C.x) * z0;
  const wideSy = H / 2 + (TARGET.cy - WIN_C.y) * z0;
  let zoom = z0;
  let k = 0; // 0 = 全景构图，1 = 目标居中
  if (f >= PUSH && f < HIT) {
    const p = ramp(f, PUSH, HIT - PUSH, EASE.exit);
    zoom = Math.exp(mix(Math.log(z0), Math.log(PEAK), p)); // log 空间：感知上的推进速度均匀加速
    k = p;
  } else if (f >= HIT) {
    const t = f - HIT;
    zoom = REST + (PEAK - REST) * Math.exp(-t / 2.2) * Math.cos((Math.PI * t) / 5.2);
    zoom *= 1 + 0.015 * ramp(f, 94, 50, EASE.smooth); // slow creep in the tail hold
    k = 1;
  }
  const tilt = f >= PUSH ? tilt0 * (1 - ramp(f, PUSH, HIT - PUSH, EASE.exit)) : tilt0;
  const shift = ramp(f, SHIFT, 22, EASE.swift);
  const sx = mix(wideSx, v ? W / 2 : mix(960, CARD_X_END, shift), k);
  const sy = mix(wideSy, v ? mix(H / 2, CARD_Y_END_V, shift) : 540, k);
  return { zoom, sx, sy, tilt };
};

// 一个相机姿态下的整个世界（窗口 + 页面 + 角标），给运动模糊子帧复用
const World: React.FC<{ f: number; lift: number; lock: number; breath: number; fmt: Fmt }> = ({ f, lift, lock, breath, fmt }) => {
  const { zoom, sx, sy, tilt } = camAt(f, fmt);
  const tx = sx - TARGET.cx * zoom;
  const ty = sy - TARGET.cy * zoom;
  // 角标：外扩量由锁定进度与预备呼吸决定；线宽按 zoom 反算，屏幕上恒定 3px
  const pad = mix(150, 14, lock) + 8 * breath;
  const sw = 3 / zoom;
  const arm = 34 / Math.max(1, zoom * 0.7);
  const bx = CARD.x - pad, by = CARD.y - pad, bw = CARD.w + pad * 2, bh = CARD.h + pad * 2;
  const tilted = tilt > 0.01;
  return (
    <AbsoluteFill style={tilted ? { perspective: 2600, perspectiveOrigin: '50% 40%' } : undefined}>
      <AbsoluteFill style={tilted ? { transform: `rotateX(${tilt.toFixed(3)}deg)`, transformOrigin: '50% 60%' } : undefined}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1200, transformOrigin: '0 0', transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${zoom.toFixed(5)})` }}>
          {/* 窗口：标题栏 + 视口，深色带色相的双层影 + 顶沿受光 */}
          <div
            style={{
              position: 'absolute', left: WIN.x, top: WIN.y - CHROME, width: WIN.w, height: WIN.h + CHROME, borderRadius: WIN_R, overflow: 'hidden',
              background: C.bg,
              boxShadow: `0 0 0 1px ${alpha('#c9d2ff', 0.18)}, 0 40px 90px -10px rgba(0,0,0,0.8), 0 12px 30px rgba(0,0,0,0.55)`,
            }}
          >
            <div style={{ position: 'absolute', left: 0, top: 0, width: WIN.w, height: CHROME, background: 'linear-gradient(180deg, #1b1e24, #15171c)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['#3a3e46', '#3a3e46', '#3a3e46'].map((c, i) => (
                <div key={c} style={{ position: 'absolute', left: 24 + i * 24, top: 20, width: 14, height: 14, borderRadius: 7, background: c, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }} />
              ))}
              <div style={{ position: 'absolute', left: WIN.w / 2 - 210, top: 12, width: 420, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)', fontFamily: FONT.mono, fontSize: 15, color: '#8a93a0', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.01em' }}>
                www.lebanontcg.com/listing
              </div>
            </div>
            <div style={{ position: 'absolute', left: 0, top: CHROME, width: WIN.w, height: WIN.h, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: -WIN.x, top: -WIN.y, width: 1920, height: layout.listing.pageH }}>
                <Img src={staticFile('textures/live/listing-full.png')} style={{ position: 'absolute', width: 1920 }} />
                {/* 点名：卡片外一圈极大 spread 的影子当遮罩，周边压成暖黑；目标卡生出浮起影 */}
                {lift > 0.001 && (
                  <div
                    style={{
                      position: 'absolute', left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, borderRadius: CARD_R,
                      boxShadow: `0 0 0 4000px rgba(8,9,11,${(0.86 * lift).toFixed(3)}), ${softShadow(14 * lift, { color: '#000000', strength: 2.4 })}`,
                    }}
                  />
                )}
                {/* 高清目标卡覆盖原位，放大后文字仍锐（Q2） */}
                <Img src={staticFile('textures/live/auction-hires.png')} style={{ position: 'absolute', left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, borderRadius: CARD_R }} />
                {/* 轮廓光：主角唯一的光效，贴着圆角走（Q4） */}
                {lift > 0.001 && (
                  <div
                    style={{
                      position: 'absolute', left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, borderRadius: CARD_R, pointerEvents: 'none',
                      boxShadow: `0 0 0 ${(1.2 / zoom).toFixed(3)}px ${alpha(L.accent, 0.85 * lift)}, 0 0 ${(26 / zoom).toFixed(2)}px ${alpha(L.accent, 0.45 * lift)}`,
                    }}
                  />
                )}
                {/* 锁定角标（页面坐标）：全景里收拢点名，特写里成为取景框 */}
                {lock > 0.001 && (
                  <svg
                    width={bw + 40} height={bh + 40} viewBox={`${bx - 20} ${by - 20} ${bw + 40} ${bh + 40}`}
                    style={{ position: 'absolute', left: bx - 20, top: by - 20, overflow: 'visible', opacity: Math.min(1, lock * 4) * (1 - 0.35 * lift) }}
                  >
                    <g fill="none" stroke={L.accent} strokeWidth={sw} strokeLinecap="square">
                      <path d={`M${bx} ${by + arm} V${by} H${bx + arm}`} />
                      <path d={`M${bx + bw - arm} ${by} H${bx + bw} V${by + arm}`} />
                      <path d={`M${bx + bw} ${by + bh - arm} V${by + bh} H${bx + bw - arm}`} />
                      <path d={`M${bx + arm} ${by + bh} H${bx} V${by + bh - arm}`} />
                    </g>
                  </svg>
                )}
              </div>
            </div>
            {/* 顶沿受光：窗口上沿一道暖色内高光 */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: WIN_R, boxShadow: `inset 0 1px 0 ${alpha('#ffffff', 0.12)}`, pointerEvents: 'none' }} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 快门窗口内等权叠加：第 i 层不透明度 1/(i+1)，逐层 over 合成后恰为算术平均。
// 子帧数按本帧位移自适应：画面边缘在快门窗口内走过的像素 / 6px，封顶 44。
const SHUTTER = 0.55; // 帧（≈200° 快门）
const samplesAt = (f: number, fmt: Fmt) => {
  const a = camAt(f, fmt), b = camAt(f - SHUTTER, fmt);
  const edge = Math.abs(a.zoom - b.zoom) * 1100 + Math.hypot(a.sx - b.sx, a.sy - b.sy) + Math.abs(a.tilt - b.tilt) * 30;
  return Math.max(1, Math.min(44, Math.ceil(edge / 6)));
};
// 子帧间距（屏幕 px）→ 每层补一点各向同性模糊，把离散回波抹成连续拖影（页面小字只有 ~14px 高，
// 回波间距 6px 时肉眼仍能数出层数）
const smearAt = (f: number, n: number, fmt: Fmt) => {
  const a = camAt(f, fmt), b = camAt(f - SHUTTER, fmt);
  const edge = Math.abs(a.zoom - b.zoom) * 1100 + Math.hypot(a.sx - b.sx, a.sy - b.sy);
  // 只在真正的高速帧补：位移 <60px 不补（否则慢段整体发虚），≥260px 补满
  const fast = Math.min(1, Math.max(0, (edge - 60) / 200));
  return Math.min(4, (edge / Math.max(1, n)) * 0.6 * fast);
};

export const CrashAuction: React.FC = () => {
  const frame = useCurrentFrame() + LEAD;
  const fmt = useFmt();
  const { v } = fmt;
  const lock = ramp(frame, 12, 16, EASE.snappy);
  const breath = ramp(frame, 32, 6, EASE.smooth) * (1 - ramp(frame, PUSH, 4, EASE.exit));
  const lift = ramp(frame, HIT + 1, 16, EASE.out);
  const flash = frame >= HIT ? Math.exp(-(frame - HIT) / 3) : 0;
  // 急推段画面收边：暗角随推进加深，落定后退回
  const vig = 0.1 + 0.3 * ramp(frame, PUSH, HIT - PUSH, EASE.exit) - 0.36 * ramp(frame, HIT, 18, EASE.out);
  // 舞台在急推后几乎被窗口盖满；全景时它负责"产品在舞台上"
  const wideFade = 1 - ramp(frame, PUSH, HIT - PUSH, EASE.exit);
  const n = frame >= PUSH && frame <= HIT + 1 ? samplesAt(frame, fmt) : 1;
  const smear = n > 1 ? smearAt(frame, n, fmt) : 0;
  const callout = frame >= 56;
  const scrim = ramp(frame, 56, 14, EASE.out);
  // 右栏压暗的起点跟着卡片右缘走（卡右缘 + 70px），永远不压到主角身上
  const cam = camAt(frame, fmt);
  const scrimX = cam.sx + (CARD.w / 2) * cam.zoom + 70;
  // vertical: the scrim starts under the panel's bottom edge; the readout sits under the panel's settled position
  const scrimY = cam.sy + (CARD.h / 2) * cam.zoom + 60;
  const calloutTop = CARD_Y_END_V + (CARD.h / 2) * restFor(true) + 110;
  return (
    <Stage look={L} keyLight={{ x: 0.5, y: 0.0 }} fill={{ x: 0.5, y: 1.05 }} horizon={0.86} intensity={0.9} breathe={0.5} vignette={mix(0.1, 0.5, wideFade)}>
      {/* 背光：窗口身后一圈橙色光晕，勾出轮廓；地面反光椭圆 */}
      <div style={{ position: 'absolute', inset: 0, opacity: wideFade, background: `radial-gradient(ellipse 38% 44% at 50% 46%, ${alpha(L.accent2, 0.11)}, ${alpha(L.accent2, 0)} 70%)` }} />
      <div style={{ position: 'absolute', left: v ? 140 : 360, right: v ? 140 : 360, top: v ? 1420 : 900, height: 160, opacity: wideFade, borderRadius: '50%', background: `radial-gradient(closest-side, ${alpha('#9d86ff', 0.26)}, ${alpha('#9d86ff', 0)})`, filter: 'blur(8px)' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: wideFade }}>
        <Dust look={L} count={34} seed={7} drift={0.3} opacity={0.5} color="#c9d2ff" />
      </div>

      {n > 1 ? (
        Array.from({ length: n }, (_, i) => (
          <AbsoluteFill key={i} style={{ opacity: 1 / (i + 1), filter: smear > 0.3 ? `blur(${smear.toFixed(2)}px)` : undefined }}>
            <World f={frame - (SHUTTER * i) / (n - 1)} lift={lift} lock={lock} breath={breath} fmt={fmt} />
          </AbsoluteFill>
        ))
      ) : (
        <World f={frame} lift={lift} lock={lock} breath={breath} fmt={fmt} />
      )}

      {/* 到位帧暖色曝光闪：以目标卡为中心，8f 指数衰减 */}
      {flash > 0.01 && (
        <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen', background: `radial-gradient(ellipse 55% 60% at 50% 50%, ${alpha('#ffffff', 0.26 * flash)}, ${alpha(L.accent, 0.12 * flash)} 55%, ${alpha(L.accent, 0)} 80%)` }} />
      )}

      {/* 右栏读数：跟随左移让出的位置。右侧加一层暖黑压暗保证可读 */}
      {callout && (
        <>
          <div style={{ position: 'absolute', inset: 0, opacity: scrim, background: v
            ? `linear-gradient(180deg, ${alpha('#08090b', 0)} ${scrimY.toFixed(1)}px, ${alpha('#08090b', 0.96)} ${(scrimY + 90).toFixed(1)}px, ${alpha('#08090b', 0.97)} 100%)`
            : `linear-gradient(90deg, ${alpha('#08090b', 0)} ${scrimX.toFixed(1)}px, ${alpha('#08090b', 0.96)} ${(scrimX + 90).toFixed(1)}px, ${alpha('#08090b', 0.97)} 100%)` }} />
          <div style={{ position: 'absolute', left: v ? 90 : 1300, top: v ? calloutTop : 270, width: v ? 900 : 580, color: L.ink }}>
            <div style={{ ...type(34, 650, { caps: true }), letterSpacing: '0.2em', color: L.accent, display: 'flex', alignItems: 'center', gap: 16, opacity: ramp(frame, 66, 10, EASE.out), transform: `translateY(${(14 * (1 - ramp(frame, 66, 14, EASE.snappy))).toFixed(2)}px)`, fontFamily: FONT.mono }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: L.accent, boxShadow: `0 0 14px ${alpha(L.accent, 0.8)}` }} />
              Live auction
            </div>
            {/* clipPath 只裁掉行框下沿以外：逐字从线下升起时，未升起的字形不会从遮罩的内边距里露头 */}
            <div style={{ ...type(232, 700), fontFamily: FONT.display, color: L.accent, letterSpacing: '-0.02em', marginTop: 26, marginLeft: -10, clipPath: 'inset(-40px -60px 0 -60px)' }}>
              <TextReveal text="+60s" by="char" variant="rise" start={69} each={18} gap={2.2} ease={EASE.snappy} />
            </div>
            <div style={{ height: 2, width: 520, marginTop: 30, background: alpha(L.ink, 0.16), transform: `scaleX(${ramp(frame, 74, 22, EASE.snappy).toFixed(4)})`, transformOrigin: '0 50%' }} />
            <div style={{ ...type(52, 600), marginTop: 30 }}>
              <TextReveal text="bid in the final minute" by="word" variant="blur" start={77} each={16} gap={4} ease={EASE.out} />
            </div>
            <div style={{ ...type(40, 400), color: L.ink2, marginTop: 14 }}>
              <TextReveal text="extends the clock" by="word" variant="blur" start={81} each={15} gap={2} ease={EASE.out} />
              <br />
              <TextReveal text="so nobody is sniped." by="word" variant="blur" start={87} each={15} gap={2} ease={EASE.out} />
            </div>
          </div>
        </>
      )}
      <Vignette strength={Math.max(0, vig)} inner={0.42} color={L.shadow} cy={0.5} />
    </Stage>
  );
};
