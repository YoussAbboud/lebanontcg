// bake-table.mjs — pre-render the deck shot's graphite table to PNGs (stage 5 performance fix).
// The demo paints the table as CSS gradients + an feTurbulence SVG tile on a ~10k × 12k px plane. Under this machine's
// software GL that costs ~20 s per frame, so the render times out. The same CSS is rendered here once by Chromium and
// shipped as textures; DeckDeal.tsx stacks them in the demo's layer order. Only the moving top light stays live (as a
// stretched blob image, also baked here).
//
// Usage: node capture/bake-table.mjs
import pw from '/home/user/lebanontcg/node_modules/playwright-core/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { chromium } = pw;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '../public/textures/table');
fs.mkdirSync(OUT, { recursive: true });
const layout = JSON.parse(fs.readFileSync(path.join(HERE, '../src/live-layout.json'), 'utf8'));

// geometry: must match DeckDeal.tsx
const T = 4000;
const BOARD_H = layout.browse.pageH;
const PILE_CX = 1730 + layout.browse.cards[0].w / 2;
const W = 1920 + 2 * T;
const H = BOARD_H + 2 * T;
const LOW = 1 / 8; // smooth layers only

const BRUSH_SVG =
  `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='640'>` +
  `<filter id='b' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>` +
  `<feTurbulence type='fractalNoise' baseFrequency='0.0018 0.62' numOctaves='3' seed='11' stitchTiles='stitch'/>` +
  `<feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.4 0.4 0.4 0 -0.5'/>` +
  `</filter><rect width='100%' height='100%' filter='url(#b)'/></svg>`;

const jobs = [
  // brushed grain, 2x so the close orbit (zoom 1.9) stays sharp; tiled at 640px in the shot
  { file: 'brush@2x.png', w: 640, h: 640, dsf: 2, bg: `url("data:image/svg+xml;utf8,${encodeURIComponent(BRUSH_SVG)}") 0 0 / 640px 640px` },
  // base graphite + the wide specular band (both static)
  {
    file: 'base.png', w: W, h: H, dsf: LOW,
    bg: [
      `linear-gradient(104deg, transparent ${T + PILE_CX - 1600}px, rgba(220,226,236,0.07) ${T + PILE_CX - 500}px, rgba(240,244,252,0.11) ${T + PILE_CX}px, rgba(220,226,236,0.05) ${T + PILE_CX + 600}px, transparent ${T + PILE_CX + 1800}px)`,
      'linear-gradient(115deg, #1b1c1f 0%, #24262a 30%, #18191c 56%, #202226 80%, #141518 100%)',
    ].join(', '),
  },
  // far-edge falloff into the dark ground (the demo's mask ellipse, as an overlay)
  { file: 'fade.png', w: W, h: H, dsf: LOW, bg: `radial-gradient(ellipse 2600px 3600px at ${T + 960}px ${T + BOARD_H / 2}px, rgba(11,12,15,0) 40%, #0b0c0f 100%)` },
  // top light blob: the demo's radial with stops normalised to 1 : 0.25 (= 0.2 : 0.05); drawn at the demo's alpha as opacity
  { file: 'light.png', w: 512, h: 512, dsf: 1, bg: 'radial-gradient(256px 256px at 256px 256px, rgba(235,232,224,1), rgba(220,216,206,0.25) 45%, transparent 70%)' },
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const j of jobs) {
  const ctx = await browser.newContext({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: j.dsf });
  const page = await ctx.newPage();
  await page.setContent(`<html><body style="margin:0;background:transparent"><div id="t" style="width:${j.w}px;height:${j.h}px;background:${j.bg.replace(/"/g, '&quot;')}"></div></body></html>`);
  await page.locator('#t').screenshot({ path: path.join(OUT, j.file), omitBackground: true });
  await ctx.close();
  console.log(j.file);
}
await browser.close();
