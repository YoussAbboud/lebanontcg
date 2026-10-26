// outro-group-photo-launch —— 全片元素四方飞来围住字标合影，crane 落机位 + 舞台光 +
// 金尘做成发布会收场。outro/品牌收尾，多功能产品"全家福"式终镜，能量推到全片最高。
// 参考实现从 template SceneOutroLive 剥离（self-contained）：
// 9 个页面元素从四方带旋转飞入（cue 4 起每 3f 一个，飞 12f，bezier y1>1 真过冲，
// 渲染顺序=cue 顺序后到者叠上），落地强调色 glow（0.35→0）；字标 letterpress 逐字
// 登场（delay=42+i·1.8）全员退后排（opacity −12% / saturate −8%）；rule 长出 +
// 190px 延长线射出；crane 运镜 perspective rotateX(4°→0) + scale 落下后缓推；
// 发布会三件套：开场光带扫过、字标背后舞台光、20 颗确定性金尘上飘；背景页 blur 化
// 景深；落定后 sign-off hold 30f。outro 不加解说 caption 保持干净。
// 品牌轮：字标 = video-shotcraft「镜刻」标志 + 全小写字标（品牌字体），标志与字母同一套 letterpress
// 入场（标志先压 4f）；下方眉题换成品牌短句。背景页 / 合影元素是真实截图纹理，里面的字保留。
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing } from 'remotion';
import { PageCam2D } from '../fixtures/PageCam2D';
import { EASE, FONT, Grain, SpeedBlur, ramp, velocity } from '../fixtures/Polish';
import layout from '../live-layout.json';
import { BRAND, COPY, FlagMark } from '../fixtures/Brand';
import { C } from '../theme';

// LebanonTCG adaptation: every feature sends one real cutout to the group photo — the nav, the hero listing card,
// two Browse cards, the live auction panel, a chat bubble, the non-binding offer card, a Pre-Grade slot and the
// search bar. The wordmark is the site's lockup (flag mark + LEBANONTCG + acid dot); under it the site description
// and the URL as the largest supporting line (Q11). Dark stage instead of cream paper; acid/white dust instead of gold.
// Retimed for the 174f slot so the stamp lands on b78 (local 87, slam #2): elements fly in (the demo's
// 12f flight, y1>1 overshoot, speed blur and press are kept), crane spans 0–70f, and every wordmark-side event is the
// demo's +45f (mark 83, letters 87+1.8i, rule 103, tag 113). Sign-off hold ≥44f before the 12f fade.
export const OUTRO_GROUP_PHOTO_LAUNCH_DURATION = 174;
const W = 45; // wordmark-side shift

const MONO = FONT.mono;
const LETTERS = 'LEBANONTCG'.split('');
const PAGE_H = layout.browse.pageH;

const FLY_EASE = Easing.bezier(0.34, 1.4, 0.44, 1);
const CRANE_EASE = Easing.bezier(0.3, 0, 0.2, 1);

type FlyEl = {
  key: string;
  file: string;
  w: number;
  h: number;
  cx: number;
  cy: number;
  scale: number;
  rot: number;
  dx: number;
  dy: number;
  radius: number;
  cue: number;
};

// render order = cue order, so later arrivals stack on top
const ELS: FlyEl[] = [
  { key: 'nav', file: 'nav.png', w: 1398, h: 81, cx: 960, cy: 80, scale: 0.62, rot: 0, dx: 0, dy: -120, radius: 10, cue: 12 },
  { key: 'hero', file: 'hero-hires.png', w: 261, h: 571, cx: 250, cy: 370, scale: 0.75, rot: -5, dx: -500, dy: 0, radius: 18, cue: 17 },
  { key: 'card6', file: 'card6.png', w: 261, h: 571, cx: 1680, cy: 455, scale: 0.7, rot: 4, dx: 500, dy: 0, radius: 18, cue: 22 },
  { key: 'auction', file: 'auction-panel.png', w: 784, h: 382, cx: 1470, cy: 810, scale: 0.6, rot: -3, dx: 450, dy: 260, radius: 16, cue: 27 },
  { key: 'card8', file: 'card8.png', w: 260, h: 571, cx: 240, cy: 860, scale: 0.62, rot: 3, dx: -400, dy: 300, radius: 18, cue: 32 },
  { key: 'offer', file: 'bubble8.png', w: 300, h: 190, cx: 680, cy: 935, scale: 1.1, rot: 2, dx: 0, dy: 320, radius: 16, cue: 37 },
  { key: 'search', file: 'float-search.png', w: 1088, h: 48, cx: 760, cy: 190, scale: 0.6, rot: -1.5, dx: 0, dy: -240, radius: 24, cue: 42 },
  { key: 'slot', file: 'slot1.png', w: 230, h: 231, cx: 1060, cy: 955, scale: 0.9, rot: -2, dx: 380, dy: 0, radius: 16, cue: 47 },
  { key: 'bubble', file: 'bubble6.png', w: 643, h: 96, cx: 1540, cy: 185, scale: 0.85, rot: 2.5, dx: 360, dy: -200, radius: 16, cue: 52 },
];

// 20 gold dust motes, all parameters index-derived (deterministic)
// 质感：每颗带一圈暖光晕（亮场上才看得见"金"），另加 6 颗前景失焦大光斑（bokeh）做景深层
const DUST = Array.from({ length: 20 }, (_, i) => ({
  x: (i * 439 + 137) % 1920,
  y0: (i * 613 + 271) % 1080,
  rise: 0.3 + (i % 5) * 0.11,
  swayAmp: 9 + (i % 4) * 5,
  swayFreq: 0.022 + (i % 3) * 0.008,
  phase: (i * 0.83) % (Math.PI * 2),
  size: 2.4 + (i % 3) * 0.9,
  opacity: 0.35 + ((i * 7) % 5) * 0.09,
}));
const BOKEH = Array.from({ length: 6 }, (_, i) => ({
  x: (i * 701 + 260) % 1920,
  y0: (i * 389 + 640) % 1080,
  rise: 0.55 + (i % 3) * 0.2,
  size: 14 + (i % 3) * 7,
  opacity: 0.1 + (i % 2) * 0.06,
}));

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = OUTRO_GROUP_PHOTO_LAUNCH_DURATION;

  const blur = interpolate(frame, [0, 40], [0, 14], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.4, 0, 0.4, 1),
  });
  const rule = interpolate(frame, [58 + W, 70 + W], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.3, 0, 0.2, 1),
  });
  const tag = ramp(frame, 68 + W, 12, EASE.out);
  const url = ramp(frame, 74 + W, 12, EASE.out);
  // 收尾淡到暖墨色（显式底色，不淡到透明），ease-in：先慢后快地"熄灯"
  const fadeOut = 1 - ramp(frame, duration - 12, 11, EASE.exit); // 末帧恰好全暗，定格尾帧干净
  const recede = interpolate(frame, [42 + W, 50 + W], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // crane on the whole group-photo layer
  const craneT = interpolate(frame, [0, 70], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: CRANE_EASE,
  });
  // 缓推从零速起步（与 crane 的减速收尾衔接，避免 f40 处速度突变）
  const pushT = ramp(frame, 66, duration - 66, EASE.smooth);
  const camScale = 1.06 - 0.06 * craneT + 0.035 * pushT;
  const camTilt = 4 * (1 - craneT);

  // opening light sweep
  const sweepX = interpolate(frame, [2, 14], [-700, 2020], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.4, 0, 0.6, 1),
  });
  const sweepOpacity = interpolate(frame, [2, 5, 11, 14], [0, 0.12, 0.12, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // stage light behind the wordmark
  const stageLight = interpolate(frame, [42 + W, 50 + W, 58 + W], [0, 0.55, 0.32], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const vignette = interpolate(frame, [42 + W, 54 + W], [0, 0.35], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // rule extension lines
  const ruleExt = interpolate(frame, [58 + W, 66 + W], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.3, 0, 0.2, 1),
  });
  const ruleExtFade = interpolate(frame, [66 + W, 72 + W], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // one breath of letter-spacing once the wordmark is fully set
  const wordSpacing = interpolate(frame, [62 + W, 66 + W], [-0.01, 0.005], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.3, 0, 0.2, 1),
  });

  return (
    <AbsoluteFill style={{ background: C.bg }}>
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* group-photo layer under a slow crane-in camera */}
      <AbsoluteFill
        style={{
          transform: `perspective(1400px) rotateX(${camTilt}deg) scale(${camScale})`,
          transformOrigin: '50% 45%',
        }}
      >
        {/* blur 只作用背景页：PageCam2D 自闭合，飞入元素放在未过滤的兄弟层
            （屏幕空间坐标，与 template SceneOutroLive 同构）——放进 children
            会连"合影元素"一起糊掉，只剩字标清晰 */}
        <PageCam2D src="textures/live/browse-full-1x.png" pageH={PAGE_H} keys={[{ frame: 0, cx: 960, cy: 700, zoom: 0.75 }]} blur={blur} bg={C.bg} />
        {/* warm scrim under the flying elements */}
        <AbsoluteFill style={{ background: 'radial-gradient(1200px 800px at 50% 48%, rgba(8,9,11,0.92), rgba(8,9,11,0.84) 60%, rgba(8,9,11,0.76))', pointerEvents: 'none' }} />

        {/* group photo: elements fly in from all sides and settle around the wordmark */}
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          {ELS.map((el) => {
            if (frame < el.cue) return null;
            const t = interpolate(frame, [el.cue, el.cue + 12], [0, 1], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: FLY_EASE,
            });
            const opacity = interpolate(frame, [el.cue, el.cue + 3], [0, 1], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });
            const x = el.dx * (1 - t);
            const y = el.dy * (1 - t);
            const rot = el.rot * (2 - t);
            const scale = el.scale * (1.12 - 0.12 * t);
            const air = Math.max(0, 1 - t);
            const shadow =
              air > 0.01
                ? `0 ${10 + 26 * air}px ${24 + 46 * air}px rgba(0,0,0,${0.45 + 0.2 * air}), 0 2px 6px rgba(0,0,0,.3)`
                : '0 10px 24px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.3)';
            const settledOpacity = opacity * (1 - 0.12 * recede);
            const saturate = 1 - 0.08 * recede;
            // 方向性运动模糊：按屏幕速度（px/帧）沿飞行方向拖影，落地后为 0（替代滞后 ghost 残影）
            const posAt = (fr: number) => {
              const tt = interpolate(fr, [el.cue, el.cue + 12], [0, 1], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: FLY_EASE,
              });
              return [el.dx * (1 - tt), el.dy * (1 - tt)];
            };
            const vx = velocity((fr) => posAt(fr)[0], frame);
            const vy = velocity((fr) => posAt(fr)[1], frame);
            // 落地压实：过冲回落的那 4f 里接触影收紧、元素 1.5% 轻压
            const land = interpolate(frame, [el.cue + 9, el.cue + 12, el.cue + 16], [0, 1, 0], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });

            return (
              <SpeedBlur key={el.key} vx={vx} vy={vy} amount={0.3} max={22}>
                <div
                  style={{
                    position: 'absolute', left: el.cx - el.w / 2, top: el.cy - el.h / 2,
                    width: el.w, height: el.h,
                    transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale * (1 - 0.015 * land)})`,
                    transformOrigin: 'center center', borderRadius: el.radius, overflow: 'hidden',
                    boxShadow: land > 0.01 ? `0 ${10 - 5 * land}px ${24 - 12 * land}px rgba(0,0,0,${0.45 + 0.1 * land}), 0 2px 6px rgba(0,0,0,${0.3 + 0.1 * land})` : shadow,
                    opacity: settledOpacity, filter: `saturate(${saturate})`,
                  }}
                >
                  <Img src={staticFile(`textures/live/${el.file}`)} style={{ position: 'absolute', inset: 0, width: el.w, height: el.h, display: 'block' }} />
                </div>
              </SpeedBlur>
            );
          })}
        </AbsoluteFill>
      </AbsoluteFill>

      {/* gold dust drifting up in front of the group photo */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {DUST.map((d, i) => {
          const y = (((d.y0 - frame * d.rise) % 1080) + 1080) % 1080;
          const x = d.x + Math.sin(frame * d.swayFreq + d.phase) * d.swayAmp;
          const twinkle = 0.7 + 0.3 * Math.sin(frame * 0.21 + d.phase * 3);
          return (
            <div
              key={i}
              style={{
                position: 'absolute', left: x, top: y, width: d.size, height: d.size,
                borderRadius: '50%', background: i % 3 === 0 ? C.acid : '#e9eeff', opacity: d.opacity * twinkle,
                boxShadow: `0 0 ${d.size * 2.5}px ${d.size * 0.6}px ${i % 3 === 0 ? 'rgba(214,255,63,0.5)' : 'rgba(200,210,255,0.5)'}`,
              }}
            />
          );
        })}
        {/* 前景失焦光斑：大而虚、上飘更快，压在合影最前面做景深 */}
        {BOKEH.map((b, i) => {
          const y = (((b.y0 - frame * b.rise) % 1180) + 1180) % 1180 - 50;
          return (
            <div
              key={`b${i}`}
              style={{
                position: 'absolute', left: b.x, top: y, width: b.size, height: b.size, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(220,228,255,0.9) 0%, rgba(220,228,255,0.35) 55%, rgba(220,228,255,0) 72%)',
                opacity: b.opacity, filter: 'blur(2px)',
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* opening light sweep */}
      {sweepOpacity > 0 ? (
        <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay' }}>
          <div
            style={{
              position: 'absolute', top: 0, bottom: 0, left: sweepX - 300, width: 600,
              background: 'linear-gradient(90deg, rgba(230,236,255,0), rgba(230,236,255,1) 50%, rgba(230,236,255,0))',
              opacity: sweepOpacity,
            }}
          />
        </AbsoluteFill>
      ) : null}

      {/* stage light behind the wordmark */}
      {stageLight > 0 ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            background: 'radial-gradient(760px 380px at 960px 470px, rgba(216,222,233,0.2), rgba(216,222,233,0.06) 55%, rgba(216,222,233,0) 75%)',
            opacity: stageLight,
          }}
        />
      ) : null}

      {/* closing vignette */}
      {vignette > 0 ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            background: 'radial-gradient(1400px 900px at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.7) 100%)',
            opacity: vignette,
          }}
        />
      ) : null}

      {/* wordmark sign-off */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: BRAND.font, fontSize: 132, fontWeight: 700, lineHeight: 1.18, color: C.ink, letterSpacing: `${0.03 + wordSpacing}em`, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            // letterpress：下沿 1px 纸面高光 + 一层极软的环境影，让字标"压"在合影之上而不是浮在纸上
            textShadow: '0 2px 0 rgba(0,0,0,0.5), 0 14px 40px rgba(0,0,0,0.55)',
          }}>
            {(() => {
              // 标志先压：比首字母早 4f，同一套 letterpress（上抬 + 放大 + 虚焦 → 落定）
              const t = interpolate(frame, [38 + W, 46 + W], [0, 1], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0.75, 0.3, 1),
              });
              return (
                <div style={{
                  marginRight: 36, opacity: t, transform: `translateY(${(1 - t) * 28}px) scale(${1.35 - 0.35 * t})`,
                  filter: t < 0.995 ? `blur(${(1 - t) * 8}px)` : undefined,
                }}>
                  <FlagMark size={150} />
                </div>
              );
            })()}
            {LETTERS.map((ch, i) => {
              const delay = Math.round(42 + W + i * 1.8);
              const t = interpolate(frame, [delay, delay + 8], [0, 1], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0.75, 0.3, 1),
              });
              return (
                <span
                  key={i}
                  style={{
                    opacity: t, transform: `translateY(${(1 - t) * 28}px) scale(${1.35 - 0.35 * t})`,
                    filter: `blur(${(1 - t) * 8}px)`, display: 'inline-block', whiteSpace: 'pre',
                  }}
                >
                  {ch}
                </span>
              );
            })}
            {(() => {
              const delay = Math.round(42 + W + LETTERS.length * 1.8);
              const t = interpolate(frame, [delay, delay + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0.75, 0.3, 1) });
              return <span style={{ opacity: t, transform: `translateY(${(1 - t) * 28}px) scale(${1.35 - 0.35 * t})`, filter: `blur(${(1 - t) * 8}px)`, display: 'inline-block', color: C.acid, marginLeft: 22 }}>.</span>;
            })()}
          </div>
          <div style={{ position: 'relative', height: 6, width: 260, margin: '34px auto 0' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 3, background: C.acid, transform: `scaleX(${rule})` }} />
            {ruleExt > 0 && ruleExtFade > 0 ? (
              <>
                <div style={{ position: 'absolute', top: 2.5, height: 1, right: '100%', width: 190 * ruleExt, background: C.acid, opacity: ruleExtFade }} />
                <div style={{ position: 'absolute', top: 2.5, height: 1, left: '100%', width: 190 * ruleExt, background: C.acid, opacity: ruleExtFade }} />
              </>
            ) : null}
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 32, letterSpacing: '0.16em', color: C.ink2, marginTop: 30, textTransform: 'uppercase',
            opacity: tag, transform: `translateY(${(1 - tag) * 6}px)`,
          }}>
            {COPY.description}
          </div>
          <div style={{
            fontFamily: MONO, fontWeight: 700, fontSize: 56, letterSpacing: '0.04em', color: C.acid, marginTop: 22,
            opacity: url, transform: `translateY(${(1 - url) * 6}px)`,
          }}>
            {BRAND.url}
          </div>
        </div>
      </AbsoluteFill>
      {/* 极弱胶片颗粒：大面积奶白纸面防色带 */}
      <Grain opacity={0.06} blend="soft-light" />
    </AbsoluteFill>
    </AbsoluteFill>
  );
};
