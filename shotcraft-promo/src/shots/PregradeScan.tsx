// scanline-annotate-focus — 扫描分析取景标注：一条扫描线自上而下匀速掠过一张已存在的品牌官网，
// 扫过哪个区块的下缘，哪块就被一组取景角标"收拢对准"，随后贴一枚机器标签把它命名；顶部状态行实时计数。
//
// 第二轮重设计（暖沙官网 × 钴蓝机器视线）：
// - look = sand（米色 · 赤陶）。被分析的是 video-shotcraft 的官网：镜刻标志 + 字标、大号粗黑体 H1「Your product, in motion.」、
//   一支样片（陶器品牌 Tide Vase 的发布片封面，手绘感陶瓶）、赤陶色 CTA、四色色板——页面本身就是一张好看的品牌页。
// - 两套颜色严格分工：赤陶 = 品牌（页面内容），钴蓝 = 机器（扫描线 / 角标 / 标签 / 状态行）。
//   标签照设计工具的选中标签惯例做成钴蓝底白字小签，32px 等宽字，任何底上都读得清。
// - 页面放进一扇有两层软阴影的浏览器窗（1560×840），状态行在窗外上方；全程 1.000→1.035 极缓推镜。
// - 扫描线严格匀速（机器的视线，不加缓动）：3px 钴蓝光芯 + 身后 140px 渐隐的"已读"淡蓝余晖与点阵；
//   窗框两侧各一枚随线滑动的游标，左侧读出当前 Y 坐标。
// - 取景框：四个 L 角从外扩 76px 处按弹簧（damping 15，一次可见过冲）收拢到 bbox，臂长晚 3f 收一档（跟随）；
//   对准瞬间框内钴蓝对焦闪；标签 5f 后从左擦出、文字逐字打出（机器在写）。
//
// 时间表（30fps，共 150f）：
//   0–6     页面已在场（它本来就存在），状态行亮起 READING
//   6–80    扫描线匀速 −20→860（74f）；越过 bbox 下缘即触发（≥4f 最小间隔）：
//           LOGO ~19f · NAV ~23f · H1 ~47f · CTA ~66f · HERO ~70f · PALETTE ~75f
//   ft+0–14 角标弹簧收拢；ft+5–14 标签擦出 + 打字
//   80–88   扫描线淡出；状态行切 BRAND READ · 6 SIGNALS（钴蓝）
//   88–150  hold：全部标注就位，极缓推镜让画面活着，尾帧是一张完整海报
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { EASE, FONT, ramp, softShadow } from '../fixtures/Polish';
import { LOOKS, Stage, alpha, springAt } from '../fixtures/Look';
import layout from '../live-layout.json';
import { COPY } from '../fixtures/Brand';
import { Caption } from './Caption';

// LebanonTCG adaptation: the page is the real Pre-Grade page (captured in a 1560×880 window); the targets are its
// eight guided capture slots, labelled with what each photo is for (centering / corner / surface — the page's own
// guidance). Colour split kept: page = acid (the product), machine = cyan (the brand gradient's middle stop).
// Scan 6→80f uniform, trigger = line crosses the bbox bottom (min gap 4f), spring brackets (damping 15), ~2.2 chars/f
// labels, live counter — all the demo's. The window is scaled 0.86 so the caption (C1, ≥56px) has its own band.
// Slot is 146f; the demo's 150f hold is trimmed by 4f.
export const SCANLINE_ANNOTATE_FOCUS_DURATION = 146;

const L = LOOKS.ltcg;
const MACHINE = '#35e4ff'; // machine colour (cyan): scan line / brackets / labels / status only
const ON_MACHINE = '#08090b';
const MONO = FONT.mono;

// 浏览器窗（帧坐标）
const WX = 180;
const WY = 150;
const WW = 1560;
const WH = 880;

// 扫描线（页面坐标，窗内 y）：严格匀速
const SCAN0 = 6;
const SCAN1 = 80;
// The window shows the slot area of the page, scaled up: page (OX, OY) maps to the window's top-left at PS×.
const PS = 1.143;
const OX = 97;
const OY = 100;
const Y0 = OY - 20 / PS; // scan range in PAGE coordinates (window −20 → WH)
const Y1 = OY + WH / PS;
const scanY = (f: number) => Y0 + (Y1 - Y0) * Math.min(1, Math.max(0, (f - SCAN0) / (SCAN1 - SCAN0)));
const frameAtY = (y: number) => SCAN0 + ((y - Y0) / (Y1 - Y0)) * (SCAN1 - SCAN0);

// ───────────── 分析目标（页面坐标；tag = 标签相对 bbox 的放置） ─────────────
type Tag = 'right' | 'above' | 'below' | 'belowRight' | 'header';
type Target = { key: string; x: number; y: number; w: number; h: number; head: string; detail: string; tag: Tag; ft: number };
const PURPOSE = ['CENTERING', 'CENTERING', 'CORNER', 'CORNER', 'CORNER', 'CORNER', 'SURFACE', 'SURFACE'];
const TARGETS: Target[] = (() => {
  const ts: Target[] = layout.pregrade.slots.map((s, i) => ({
    key: `slot${i + 1}`, x: s.x, y: s.y, w: s.w, h: s.h, head: PURPOSE[i], detail: '', tag: 'header' as Tag, ft: 0,
  }));
  let prev = -99;
  for (const t of [...ts].sort((a, b) => a.y + a.h - (b.y + b.h) || a.x - b.x)) {
    t.ft = Math.max(frameAtY(t.y + t.h), prev + 4);
    prev = t.ft;
  }
  return ts;
})();
export const SCAN_FIRES = TARGETS.map((t) => t.ft).sort((a, b) => a - b);
const LAST_FIRE = Math.max(...TARGETS.map((t) => t.ft));

const Page: React.FC = () => (
  <Img src={staticFile('textures/live/pregrade-full.png')} style={{ position: 'absolute', left: 0, top: 0, width: layout.pregrade.pageW, height: layout.pregrade.pageH }} />
);
// page space → window space
const PageSpace: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: layout.pregrade.pageW, height: layout.pregrade.pageH, transformOrigin: '0 0', transform: `scale(${PS}) translate(${-OX}px, ${-OY}px)` }}>
    {children}
  </div>
);
const winY = (pageY: number) => (pageY - OY) * PS;

// ───────────── 取景框 + 标签 ─────────────
const Bracket: React.FC<{ t: Target; frame: number }> = ({ t, frame }) => {
  const f = frame - t.ft;
  if (f < 0) return null;
  const s = springAt(frame, t.ft, { damping: 15, stiffness: 210 }); // 0→1（过冲 ~1.06）
  const pad = 76 * (1 - s); // 外扩 76px → 0（过冲时略收进 bbox）
  const op = Math.min(1, f / 3);
  const arm = 40 - 14 * ramp(frame, t.ft + 3, 12, EASE.out); // 臂长晚一拍收一档
  const flash = ramp(frame, t.ft + 3, 3, EASE.out) * (1 - ramp(frame, t.ft + 6, 12, EASE.out));
  const x = t.x - pad;
  const y = t.y - pad;
  const w = t.w + pad * 2;
  const h = t.h + pad * 2;
  const d = [
    `M${x} ${y + arm}V${y}H${x + arm}`,
    `M${x + w - arm} ${y}H${x + w}V${y + arm}`,
    `M${x + w} ${y + h - arm}V${y + h}H${x + w - arm}`,
    `M${x + arm} ${y + h}H${x}V${y + h - arm}`,
  ].join('');
  return (
    <>
      <div style={{ position: 'absolute', left: t.x, top: t.y, width: t.w, height: t.h, borderRadius: 6, background: alpha(MACHINE, 0.075 * flash), boxShadow: `inset 0 0 0 2px ${alpha(MACHINE, 0.4 * flash)}` }} />
      <svg width={layout.pregrade.pageW} height={layout.pregrade.pageH} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: op }}>
        <path d={d} fill="none" stroke={MACHINE} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );
};

// The slots sit 14px apart under a paragraph, so the card's outside placements land on content. 'header' lays the tag over
// the slot's own 11px mono header row (texture-size text), full slot width so no fragments show; 33px page = ~32px on screen (Q11).
const TAG_H = 44;
const TAG_FONT = 33;
const CHAR_W = 0.6 * TAG_FONT; // 等宽字步进
const tagWidth = (t: Target) => Math.round((t.head.length + (t.detail ? 3 + t.detail.length : 0)) * CHAR_W + 34);

const Label: React.FC<{ t: Target; frame: number }> = ({ t, frame }) => {
  const s0 = t.ft + 5;
  if (frame < s0) return null;
  const rise = ramp(frame, s0, 12, EASE.out);
  const pop = ramp(frame, s0, 4, EASE.out);
  const full = t.detail ? `${t.head} · ${t.detail}` : t.head;
  const typedF = Math.min(full.length, (frame - s0) * 2.2 + 1); // 机器在写：~2 字/帧
  const typed = Math.floor(typedF);
  const w = t.tag === 'header' ? t.w - 16 : tagWidth(t); // 定位用的最终宽度
  const wNow = Math.min(w, typedF * CHAR_W + 34); // 签条随字长出来（右缘略领先于字）
  const typing = typed < full.length;
  let x = t.x;
  let y = t.y;
  if (t.tag === 'right') { x = t.x + t.w + 16; y = t.y + (t.h - TAG_H) / 2; }
  if (t.tag === 'above') { x = t.x; y = t.y - TAG_H - 10; }
  if (t.tag === 'below') { x = t.x; y = t.y + t.h + 12; }
  if (t.tag === 'belowRight') { x = t.x + t.w - w; y = t.y + t.h + 10; }
  if (t.tag === 'header') { x = t.x + 8; y = t.y + 3; }
  const head = full.slice(0, Math.min(typed, t.head.length));
  const rest = typed > t.head.length ? full.slice(t.head.length, typed) : '';
  return (
    <div style={{
      position: 'absolute', left: t.tag === 'belowRight' ? x + w - wNow : x, top: y, width: wNow, height: TAG_H, borderRadius: 10, background: MACHINE,
      boxShadow: `0 10px 22px -10px ${alpha('#000000', 0.7)}, inset 0 1px 0 rgba(255,255,255,0.4)`,
      opacity: pop, overflow: 'hidden',
      transform: `translateY(${((1 - rise) * 8).toFixed(2)}px)`,
      display: 'flex', alignItems: 'center', paddingLeft: 17, boxSizing: 'border-box',
      font: `600 ${TAG_FONT}px ${MONO}`, letterSpacing: 0, whiteSpace: 'pre', color: ON_MACHINE,
    }}>
      <span style={{ fontWeight: 750 }}>{head}</span>
      <span style={{ color: 'rgba(8,9,11,0.7)', fontWeight: 500 }}>{rest}</span>
      {typing && <span style={{ display: 'inline-block', width: 14, height: 28, marginLeft: 2, background: 'rgba(8,9,11,0.8)' }} />}
    </div>
  );
};

export const PregradeScan: React.FC = () => {
  const frame = useCurrentFrame();
  const ly = winY(scanY(frame)); // window-space line position
  const lyPage = scanY(frame);
  const lineOn = ramp(frame, SCAN0 - 4, 5, EASE.out) * (1 - ramp(frame, SCAN1, 8, EASE.exit));
  const fired = TARGETS.filter((t) => frame >= t.ft).length;
  const done = ramp(frame, LAST_FIRE + 8, 8, EASE.out);
  const push = 0.86 * (1 + 0.035 * ramp(frame, 0, SCANLINE_ANNOTATE_FOCUS_DURATION, EASE.swift)); // window at 0.86 + the demo's slow push
  const statusIn = ramp(frame, 0, 10, EASE.out);
  const scanProg = Math.min(1, Math.max(0, (frame - SCAN0) / (SCAN1 - SCAN0)));

  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.3, y: 0.05 }} fill={{ x: 0.9, y: 0.95 }} vignette={0.45} />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push.toFixed(5)})`, transformOrigin: '50% 10%' }}>
        {/* ── 状态行（窗外上方）── */}
        <div style={{ position: 'absolute', left: WX, top: 70, width: WW, height: 52, opacity: statusIn, font: `600 38px ${MONO}`, color: L.ink, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, marginRight: 16, background: done > 0.5 ? MACHINE : alpha(MACHINE, 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(frame / 3))), boxShadow: `0 0 0 6px ${alpha(MACHINE, 0.12)}` }} />
          <span style={{ color: done > 0.5 ? MACHINE : L.ink, letterSpacing: '0.06em' }}>{done > 0.5 ? 'EIGHT GUIDED PHOTOS' : 'READING'}</span>
          <span style={{ color: L.ink3, marginLeft: 18, fontWeight: 500 }}>PRE-GRADE</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 220, height: 6, borderRadius: 3, background: alpha(L.ink, 0.1), overflow: 'hidden' }}>
              <div style={{ width: `${(scanProg * 100).toFixed(2)}%`, height: '100%', background: MACHINE, borderRadius: 3 }} />
            </div>
            <span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
              <span style={{ color: L.ink3, fontWeight: 500 }}>PHOTOS </span>
              <span style={{ color: fired === TARGETS.length ? MACHINE : L.ink }}>{String(fired).padStart(2, '0')}</span>
              <span style={{ color: L.ink3 }}> / {String(TARGETS.length).padStart(2, '0')}</span>
            </span>
          </div>
        </div>

        {/* ── 浏览器窗：页面 + 扫描余晖（裁进窗内）── */}
        <div style={{ position: 'absolute', left: WX, top: WY, width: WW, height: WH, borderRadius: 20, overflow: 'hidden', boxShadow: `${softShadow(30, { color: L.shadow, strength: 2.2 })}, 0 0 0 1px ${alpha(L.ink, 0.1)}` }}>
          <PageSpace><Page /></PageSpace>
          {/* 已读余晖：扫描线身后 140px 的淡蓝洗色 + 点阵（机器"读过"的痕迹） */}
          {lineOn > 0.01 && (
            <>
              <div style={{
                position: 'absolute', left: 0, width: WW, top: ly - 140, height: 140, opacity: lineOn,
                background: `linear-gradient(180deg, ${alpha(MACHINE, 0)} 0%, ${alpha(MACHINE, 0.05)} 60%, ${alpha(MACHINE, 0.13)} 100%)`,
              }} />
              <div style={{
                position: 'absolute', left: 0, width: WW, top: ly - 90, height: 90, opacity: lineOn * 0.8,
                backgroundImage: `radial-gradient(circle, ${alpha(MACHINE, 0.55)} 1.3px, transparent 1.9px)`, backgroundSize: '18px 18px', backgroundPosition: '0 0',
                WebkitMaskImage: 'linear-gradient(180deg, transparent, #000)', maskImage: 'linear-gradient(180deg, transparent, #000)',
              }} />
              <div style={{
                position: 'absolute', left: 0, width: WW, top: ly - 1.5, height: 3, opacity: lineOn, background: MACHINE,
                boxShadow: `0 0 10px ${alpha(MACHINE, 0.55)}, 0 0 28px ${alpha(MACHINE, 0.3)}`,
              }} />
            </>
          )}
        </div>

        {/* ── 窗框两侧游标：随线滑动，左侧读出 Y ── */}
        {lineOn > 0.01 && (
          <div style={{ opacity: lineOn }}>
            <svg width={22} height={26} viewBox="0 0 22 26" style={{ position: 'absolute', left: WX - 30, top: WY + ly - 13 }}>
              <path d="M2 2 L20 13 L2 24 Z" fill={MACHINE} />
            </svg>
            <svg width={22} height={26} viewBox="0 0 22 26" style={{ position: 'absolute', left: WX + WW + 8, top: WY + ly - 13 }}>
              <path d="M20 2 L2 13 L20 24 Z" fill={MACHINE} />
            </svg>
            <div style={{ position: 'absolute', left: WX - 150, top: WY + ly - 14, width: 112, textAlign: 'right', font: `600 22px ${MONO}`, color: MACHINE, fontVariantNumeric: 'tabular-nums' }}>
              Y {String(Math.max(0, Math.round(lyPage))).padStart(4, '0')}
            </div>
          </div>
        )}

        {/* ── 取景框与标签（页面坐标，叠在窗上；不裁切，标签可略出框）── */}
        <div style={{ position: 'absolute', left: WX, top: WY, width: WW, height: WH }}>
          <PageSpace>
            {TARGETS.map((t) => <Bracket key={t.key} t={t} frame={frame} />)}
            {TARGETS.map((t) => <Label key={t.key} t={t} frame={frame} />)}
          </PageSpace>
        </div>
      </div>
      <Caption text={COPY.pregrade} start={96} end={SCANLINE_ANNOTATE_FOCUS_DURATION} />
    </AbsoluteFill>
  );
};
