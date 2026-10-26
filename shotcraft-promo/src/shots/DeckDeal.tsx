// deck-deal-flyin —— 牌堆特写环绕 → 预备 → 一摞卡硬加速发进网格 → 相机追着发牌升起 → 满板定格（第二轮重设计）
// 手法不变：实体牌堆（真实卡片切片）特写 orbit 开局，预备拍后 26 张卡按阅读序、出牌间隔硬加速地甩进页面网格，
// 相机追着发牌走，满板后停住。
//
// 设计决定
// - look = graphite（近单色暗场 · 白为强调 · 一点香槟金）。整镜头发生在一张暗色拉丝石墨桌面上：
//   牌堆放在页面板（真实 projects 截图，Q1 纹理保留）右侧的桌面上，一盏顶光只打牌堆；
//   拉远时"灯"从牌堆亮到页面板（板面由暗到亮的光圈），页面板像一块被摆上桌的白色展板，四周始终是暗场——
//   不再整屏切成白纸，暗/亮反差贯穿到最后一帧。
// - 相机：一条连续的单调 Hermite 样条（关键帧处速度连续，无顿挫）——低机位侧斜绕牌堆 → 拉远正视板顶 →
//   追着越发越快的牌往板尾走、同时升高后仰 → 落在一张"跑道式"俯瞰：整块板沿对角线伸向远处，
//   26 张卡全部在画，近大远小（满板的体量一眼可见）。俯瞰位只保留极缓推近（1.5%）。
// - 景深：俯瞰位远端（板首）压暗 + 降对比，近端最亮——光跟着最后几张卡走到镜头前。
// - 版式：满板后左下升起两行标题「Your product, / in motion.」（video-shotcraft 标语，120px 800/300 字重对比）+ 一行 mono 计数
//   「video-shotcraft 标志 · 26 REAL PAGE CAPTURES」——计数在发牌期间就跟着落地数跳（26 张卡 = 26）。
//
// 时间表（30fps，共 150f）
//   0–28    orbit：侧斜低机位绕牌堆（rotY −30°→+26°），顶光只打牌堆，板面暗
//   26–36   预备：牌堆整体下压 48px、顶卡向出牌反方向回拉 30px（过肉眼阈值判例）
//   36–~101 发牌：第 k 张 cue = 36 + 4k − 0.0792·k(k−1)（间隔 4f → 0.2f 硬加速），
//           单卡 8f 俯冲（z 弧顶 + 峰值 1.06x）+ 4f 过冲落定 + 2f press；飞行残影
//   34–62   拉远：板面光圈亮起，相机正视板顶
//   62–108  追逐 + 升起：相机沿板往下追、升高后仰、侧转 → 跑道俯瞰
//   100–126 标题逐词升起、计数行定格
//   108–150 hold：满板静止（> 0.5s），极缓推近 + 光的呼吸
import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing } from 'remotion';
import { EASE, FONT, ramp } from '../fixtures/Polish';
import { LOOKS, Stage, TextReveal, alpha, type } from '../fixtures/Look';
import layout from '../live-layout.json';
import { COPY, FlagMark } from '../fixtures/Brand';
import { C } from '../theme';

// LebanonTCG adaptation: the 24 real listing cards of the Browse page (cutouts + the hidden-card backplate) are the deck;
// the board is the site's own dark frame (x 260–1660), so no extra rows are needed (24 cards, not 26). The pile sits on
// the table right of the board. Camera anchors, deal cue formula, anticipation (48/30px), dive/settle/press and the
// drag hierarchy are the demo's. Copy: product line + games list; counter uses the flag mark. Slot is 160f (b20→b31):
// the extra 10f extend the full-board hold (R2: rest after the flood). The camera's last key stays at 174 (slow creep).
export const DECK_DEAL_FLYIN_DURATION = 174;

const L = LOOKS.ltcg;
const cards = layout.browse.cards;
const PAGE_H = layout.browse.pageH;
const PAPER = C.frame;

// 页面板：只取内容区（左右各留一截页边），下方纸面延长容纳 16 张溢出卡
const BOARD = { x: layout.browse.frame.x, w: layout.browse.frame.w };
const CARD_W = cards[0].w;
const BOARD_H = PAGE_H;
const extras: { file: string; x: number; y: number; w: number; h: number }[] = [];

// 牌堆：放在板右侧的桌面上（页面坐标）
const PILE = { x: 1730, y: 250 };
const N_CARDS = cards.length;
const DEAL_START = 36;
const STACK_STEP = 3;
const PILE_CX = PILE.x + CARD_W / 2;
const PILE_CY = PILE.y + cards[0].h / 2;

const grid = [...cards.map((c) => ({ file: c.file, x: c.x, y: c.y, w: c.w, h: c.h })), ...extras]
  .sort((a, b) => a.y - b.y || a.x - b.x)
  .map((c, k) => ({
    ...c,
    cue: DEAL_START + 4 * k - 0.0792 * k * (k - 1),
    px: PILE.x + (((k * 7) % 9) - 4) * 2,
    py: PILE.y + (((k * 5) % 7) - 3) * 2,
    protZ: ((k * 11) % 7) - 3,
    pz: (N_CARDS - k) * STACK_STEP,
  }));

const HOVER_H = 40;
const SETTLE_EASE = Easing.bezier(0.3, 0, 0.25, 1.15);
const DIVE_EASE = Easing.bezier(0.3, 0, 0.2, 1);
const ANTICIPATE = { from: 26, to: 36, pileDown: 48, topPull: 30 };

// ───────────── 相机：单调三次 Hermite 样条（各参数分别过锚点，关键帧处速度连续） ─────────────
type Cam = { cx: number; cy: number; zoom: number; rotX: number; rotY: number; rotZ: number; persp: number; sx: number };
type Key = Cam & { frame: number };
const ANCHORS: Key[] = [
  { frame: 0, cx: PILE_CX - 40, cy: PILE_CY + 60, zoom: 1.9, rotX: 48, rotY: -30, rotZ: 9, persp: 1100, sx: 0 },
  { frame: 30, cx: PILE_CX + 20, cy: PILE_CY + 40, zoom: 1.8, rotX: 42, rotY: 24, rotZ: -6, persp: 1100, sx: 0 },
  { frame: 62, cx: 1080, cy: 760, zoom: 0.8, rotX: 22, rotY: 0, rotZ: 2, persp: 1700, sx: 0 },
  { frame: 86, cx: 980, cy: 1720, zoom: 0.56, rotX: 38, rotY: -4, rotZ: -10, persp: 2500, sx: 120 },
  { frame: 110, cx: 960, cy: 2150, zoom: 0.5, rotX: 52, rotY: -6, rotZ: -26, persp: 3300, sx: 300 },
  { frame: DECK_DEAL_FLYIN_DURATION, cx: 960, cy: 2166, zoom: 0.511, rotX: 52, rotY: -6, rotZ: -26, persp: 3300, sx: 300 },
];
const PARAMS: (keyof Cam)[] = ['cx', 'cy', 'zoom', 'rotX', 'rotY', 'rotZ', 'persp', 'sx'];
const hermite = (xs: number[], ys: number[]) => {
  const n = xs.length;
  const d = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - x));
  const m = xs.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? 0 : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
};
const CURVES = Object.fromEntries(PARAMS.map((p) => [p, hermite(ANCHORS.map((k) => k.frame), ANCHORS.map((k) => k[p]))])) as Record<keyof Cam, (x: number) => number>;
const camAt = (f: number): Cam => Object.fromEntries(PARAMS.map((p) => [p, CURVES[p](f)])) as Cam;

// ───────────── 拉丝石墨桌面：demo 的 CSS 渐变 + feTurbulence 拉丝在 ~1 万 px 的平面上，软件 GL 下每帧 ~20s、渲染超时；
// 同一套 CSS 由 capture/bake-table.mjs 预烘成贴图（拉丝 2x 平铺 · 底色与镜面带 · 远端渐隐），层序同 demo；只有顶光保持动态 ─────────────
const TEX = {
  brush: staticFile('textures/table/brush@2x.png'),
  base: staticFile('textures/table/base.png'),
  fade: staticFile('textures/table/fade.png'),
  light: staticFile('textures/table/light.png'),
};

const T = 4000; // 桌面平面外扩（页面坐标），任意斜角不穿帮

export const DeckDeal: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = camAt(frame);

  // 板面"灯亮"：f34→64 以牌堆为圆心的柔边光圈把暗板照亮
  const lightUp = interpolate(frame, [34, 64], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.5, 0, 0.6, 1) });
  const holeR = 4200 * lightUp;
  const feather = 600 + 1000 * lightUp;
  // 俯瞰位景深：远端（板首）压暗
  const fog = ramp(frame, 80, 34, EASE.smooth);

  // 预备拍
  const antT = interpolate(frame, [ANTICIPATE.from, ANTICIPATE.to], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });

  // 计数：已落地张数
  const landed = grid.filter((c) => frame >= c.cue + 8).length;
  const statIn = ramp(frame, 90, 12, EASE.out);

  // 顶光：落在牌堆上（开场最亮），随拉远扩大成照亮整块板的大光（demo 的径向渐变 → 烘焙光斑按同尺寸/位置/强度拉伸）
  const light = {
    rx: 1100 + 1400 * lightUp, ry: 800 + 1600 * lightUp,
    x: T + PILE_CX - 600 * lightUp, y: T + PILE_CY + 900 * lightUp,
    a: 0.2 - 0.08 * lightUp, // 烘焙光斑中心 alpha=1，按 demo 原值整体压
  };

  const persp = cam.persp * cam.zoom;

  return (
    <AbsoluteFill style={{ fontFamily: FONT.sans, overflow: 'hidden' }}>
      <Stage look={L} keyLight={{ x: 0.6, y: 0.2 }} fill={null} intensity={0.5} grain={0} vignette={0} />

      {/* 3D 相机（PageCam2D 同款坐标数学：CSS zoom 做放大，Q2 文字按放大后尺寸栅格化） */}
      <AbsoluteFill style={{ transform: `translateX(${cam.sx.toFixed(2)}px)` }}>
        <div style={{ position: 'absolute', inset: 0, perspective: `${persp.toFixed(2)}px`, perspectiveOrigin: '960px 540px' }}>
          <div
            style={{
              position: 'absolute', width: 1920, height: BOARD_H, zoom: cam.zoom,
              transform: `translate(${(960 / cam.zoom - cam.cx).toFixed(3)}px, ${(540 / cam.zoom - cam.cy).toFixed(3)}px) rotateY(${cam.rotY.toFixed(3)}deg) rotateX(${cam.rotX.toFixed(3)}deg) rotateZ(${cam.rotZ.toFixed(3)}deg)`,
              transformOrigin: `${cam.cx.toFixed(2)}px ${cam.cy.toFixed(2)}px`,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* 石墨桌面：远处柔边隐进暗场 */}
            <div
              style={{
                position: 'absolute', left: -T, top: -T, width: 1920 + 2 * T, height: BOARD_H + 2 * T, overflow: 'hidden',
                background: `url(${TEX.brush}) 0 0 / 640px 640px repeat, url(${TEX.base}) 0 0 / 100% 100% no-repeat`,
              }}
            >
              <Img src={TEX.light} style={{ position: 'absolute', left: light.x - light.rx, top: light.y - light.ry, width: 2 * light.rx, height: 2 * light.ry, opacity: light.a }} />
              <Img src={TEX.fade} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            </div>

            {/* 页面板：真实截图 + 纸面延长；落在桌上的大投影 + 上沿受光 */}
            <div
              style={{
                position: 'absolute', left: BOARD.x, top: 0, width: BOARD.w, height: BOARD_H, overflow: 'hidden', borderRadius: 18,
                background: PAPER,
                boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 60px 160px rgba(0,0,0,0.7), 0 12px 40px rgba(0,0,0,0.5)',
              }}
            >
              <Img src={staticFile('textures/live/browse-empty-1x.png')} style={{ position: 'absolute', left: -BOARD.x, top: 0, width: 1920, height: PAGE_H }} />
              {/* 纸面延长段的分区小标（与截图同款排版：大写字距 + 计数） */}
              {/* 板面暗层：开场整块板在暗处，灯从牌堆处亮开（柔边光圈） */}
              {lightUp < 1 && (
                <div
                  style={{
                    position: 'absolute', inset: 0, background: 'rgba(14,14,16,0.88)',
                    WebkitMaskImage: lightUp > 0 ? `radial-gradient(circle at ${PILE_CX - BOARD.x}px ${PILE_CY}px, transparent ${holeR.toFixed(0)}px, #000 ${(holeR + feather).toFixed(0)}px)` : undefined,
                    maskImage: lightUp > 0 ? `radial-gradient(circle at ${PILE_CX - BOARD.x}px ${PILE_CY}px, transparent ${holeR.toFixed(0)}px, #000 ${(holeR + feather).toFixed(0)}px)` : undefined,
                  }}
                />
              )}
            </div>

            {/* 26 张卡：牌堆在板右侧桌面上，按硬加速节拍逐张发进网格 */}
            {grid.map((c, i) => {
              const { cue } = c;
              const diveT = interpolate(frame, [cue, cue + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: DIVE_EASE });
              const settleT = interpolate(frame, [cue + 8, cue + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: SETTLE_EASE });
              const dx = (c.px - c.x) * (1 - diveT);
              const dy = (c.py - c.y) * (1 - diveT);
              const rotFlight = c.protZ * (1 - diveT);
              const arc = Math.sin(diveT * Math.PI) * 110;
              const zDive = interpolate(diveT, [0, 1], [c.pz, HOVER_H]) + arc;
              const z = frame < cue ? c.pz : zDive * (1 - settleT);
              const dealScale = 1 + Math.sin(diveT * Math.PI) * 0.06;
              const press = interpolate(frame, [cue + 10, cue + 11, cue + 12], [1, 0.996, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              const scale = dealScale * press;
              const isLanded = frame >= cue + 12;
              const inPile = frame < cue;
              const antDy = inPile ? ANTICIPATE.pileDown * antT * (frame < ANTICIPATE.to + 2 ? 1 : 0) : 0;
              const antPull = i === 0 && inPile ? ANTICIPATE.topPull * antT : 0;
              const transform = isLanded
                ? 'translate3d(0px, 0px, 0px)'
                : inPile
                  ? `translate3d(${c.px - c.x - antPull}px, ${c.py - c.y + antDy}px, ${c.pz}px) rotateZ(${c.protZ}deg)`
                  : `translate3d(${dx}px, ${dy}px, ${z}px) rotateZ(${rotFlight}deg) scale(${scale})`;
              // 阴影：牌堆在暗桌上投重影；飞行时又高又虚；落地后在纸面上收成静置影（滞后卡体 ~3f 收敛）
              const shadowLag = interpolate(frame, [cue + 8, cue + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.out });
              const shadow = isLanded
                ? `0 ${(2 + 14 * (1 - shadowLag)).toFixed(1)}px ${(6 + 30 * (1 - shadowLag)).toFixed(1)}px rgba(0,0,0,${(0.3 + 0.2 * (1 - shadowLag)).toFixed(3)})`
                : inPile
                  ? i === N_CARDS - 1
                    ? '0 1px 3px rgba(0,0,0,.4), 0 26px 60px rgba(0,0,0,0.75)'
                    : '0 1px 2px rgba(0,0,0,.35)'
                  : `0 ${36 - 24 * settleT}px ${70 - 50 * settleT}px rgba(0,0,0,${(0.45 - 0.25 * settleT).toFixed(3)})`;
              const showGhost = diveT > 0.02 && diveT < 0.98;
              const gx = (c.px - c.x) * 0.06;
              const gy = (c.py - c.y) * 0.06;
              // 牌堆里的卡带一点顶光暗部（开场只亮顶面），灯亮后恢复
              // 落进还没被照亮的板面区域的卡同样在暗处（与板面光圈同一公式），牌堆本身只压一点暗部
              const dist = Math.hypot(c.x + c.w / 2 - PILE_CX, c.y + c.h / 2 - PILE_CY);
              const dark = Math.min(1, Math.max(0, (dist - holeR) / feather)) * 0.88 * (lightUp < 1 ? 1 : 0);
              const pileShade = inPile ? 0.08 * (1 - lightUp) : diveT > 0.6 ? dark * Math.min(1, (diveT - 0.6) / 0.4) : 0;
              return (
                <div key={`${c.file}-${i}`} style={{ transformStyle: 'preserve-3d' }}>
                  {showGhost ? (
                    <div
                      style={{
                        position: 'absolute', left: c.x, top: c.y, width: c.w, height: c.h,
                        transform: `translate3d(${dx + gx}px, ${dy + gy}px, ${z}px) rotateZ(${rotFlight}deg) scale(${scale})`,
                        opacity: 0.28 * (1 - diveT), filter: 'blur(7px)', borderRadius: 18, overflow: 'hidden',
                      }}
                    >
                      <Img src={staticFile(`textures/live/${c.file}`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
                    </div>
                  ) : null}
                  <div
                    style={{
                      position: 'absolute', left: c.x, top: c.y, width: c.w, height: c.h,
                      transform, boxShadow: shadow, borderRadius: 18, overflow: 'hidden',
                    }}
                  >
                    <Img src={staticFile(`textures/live/${c.file}`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
                    {pileShade > 0.005 && <div style={{ position: 'absolute', inset: 0, background: `rgba(10,10,12,${pileShade.toFixed(3)})` }} />}
                  </div>
                </div>
              );
            })}

            {fog > 0 && (
              <div
                style={{
                  position: 'absolute', left: BOARD.x - 2, top: -2, width: BOARD.w + 4, height: BOARD_H + 4, pointerEvents: 'none', borderRadius: 18,
                  transform: 'translateZ(1px)',
                  background: `linear-gradient(180deg, rgba(12,12,14,${(0.62 * fog).toFixed(3)}) 0%, rgba(12,12,14,${(0.3 * fog).toFixed(3)}) 35%, rgba(12,12,14,0) 70%)`,
                }}
              />
            )}
          </div>
        </div>
      </AbsoluteFill>

      {/* 暗角 + 颗粒（屏幕空间，全程） */}
      <AbsoluteFill style={{ pointerEvents: 'none', background: `radial-gradient(ellipse 75% 75% at 58% 46%, transparent 45%, ${alpha('#050506', 0.55)} 100%)` }} />

      {/* 左下：标题 + 计数行 */}
      <div style={{ position: 'absolute', left: 120, top: 664, color: L.ink }}>
        <div style={{ ...type(120, 700), fontFamily: FONT.display, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
          <TextReveal text="Listed by" by="word" variant="rise" start={100} each={16} gap={4} />
        </div>
        <div style={{ ...type(120, 700), fontFamily: FONT.display, textTransform: 'uppercase', letterSpacing: '0.01em', color: L.accent, marginTop: 4 }}>
          <TextReveal text="collectors." by="word" variant="rise" start={106} each={16} gap={4} />
        </div>
        <div style={{ ...type(40, 500), fontVariantNumeric: 'normal', color: L.ink2, marginTop: 22 }}>{/* tnum widens Inter's hyphen (Yu-Gi-Oh!) */}
          <TextReveal text={COPY.games} by="word" variant="blur" start={114} each={14} gap={3} />
        </div>
      </div>
      <div
        style={{
          position: 'absolute', left: 124, top: 610, display: 'flex', alignItems: 'center', gap: 16, opacity: statIn,
          ...type(34, 500, { mono: true }), letterSpacing: '0.14em', color: L.ink2,
        }}
      >
        <FlagMark size={38} style={{ margin: '-6px 0' }} />
        <span style={{ color: L.accent, fontVariantNumeric: 'tabular-nums', minWidth: '2.2ch' }}>{String(landed).padStart(2, '0')}</span>
        CARDS LISTED
      </div>
    </AbsoluteFill>
  );
};
