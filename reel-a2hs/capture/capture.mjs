// capture.mjs — real-page textures for the "Add to Home Screen" reel (video-shotcraft stage 4).
// Mobile layout (390-wide viewport): the page fills the 9:16 frame edge to edge at 1080/390 = 2.77×, no device mockup.
//
// Source: the project's OFFLINE MOCK BUILD (VITE_MOCK=1) served on localhost — every handle and listing is fictional
// seed data and the card art is the site's placeholder art. BASE=https://www.lebanontcg.com captures the live site with
// the same selectors. The mock-only "DEV" user switcher is hidden; time is frozen so the fan and countdowns are still.
//
// Outputs (public/textures) and src/layout.json (viewport-space boxes in CSS px, scroll 0):
//   home-3x.png            the home page's first screen, sheet suppressed (what the sheet rises over)
//   home-sheet-3x.png      the same screen with the sheet up (reference for the composite)
//   sheet-ios-4x.png       the sheet cutout, iPhone Safari wording (Share → Add to Home Screen → Add)
//   sheet-android-4x.png   the sheet cutout, Android Chrome with the one-tap install button
// Usage: npm run capture   (mock build served on :4319: `VITE_MOCK=1 npx vite build && npx vite preview --port 4319`)
import pw from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { chromium } = pw;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://localhost:4319';
const OUT = path.join(HERE, '../public/textures');
const LAYOUT = path.join(HERE, '../src/layout.json');
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium';
const NOW = new Date('2026-10-29T10:52:00+03:00');
const VW = 390;
const VH = 693; // 1920 / (1080 / 390): the CSS height one 9:16 frame shows
fs.mkdirSync(OUT, { recursive: true });
const out = (f) => path.join(OUT, f);

const UA = {
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
};
const HIDE = `.uswitch, .uswitch-btn, [class*="uswitch"] { display: none !important; }`;
// the header logo is an animated GIF: pin it to its face-on first frame
const LOGO_FRAME0 = 'data:image/png;base64,' + fs.readFileSync(path.join(HERE, 'logo-frame0.png')).toString('base64');
const pinLogo = (page) => page.evaluate((src) => document.querySelectorAll('.shell-logo-gif').forEach((i) => { i.src = src; }), LOGO_FRAME0);

const box = (loc) => loc.evaluate((e) => {
  const r = e.getBoundingClientRect();
  const q = (v) => Math.round(v * 100) / 100;
  return { x: q(r.x), y: q(r.y), w: q(r.width), h: q(r.height) };
});

async function open(browser, { dsf, ua, sheet, android = false }) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, userAgent: ua, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.clock.install({ time: NOW });
  if (android) {
    // Chrome hands the page a beforeinstallprompt once the manifest is seen; the capture dispatches the same event so
    // the sheet renders its one-tap button (the real event cannot fire for a localhost mock build).
    await page.addInitScript(() => {
      addEventListener('load', () => {
        const e = new Event('beforeinstallprompt', { cancelable: true });
        e.prompt = () => Promise.resolve();
        e.userChoice = Promise.resolve({ outcome: 'dismissed' });
        dispatchEvent(e);
      });
    });
  }
  await page.goto(BASE + '/');
  await page.waitForSelector('.shell-header');
  // the sheet is a per-visit prompt: suppressed for the clean page, allowed for the sheet captures
  await page.evaluate((show) => localStorage.setItem('ltcg.a2hs', JSON.stringify(show ? { until: 0 } : { never: true })), sheet);
  await page.reload();
  await page.waitForSelector('.fan-card');
  await page.addStyleTag({ content: HIDE });
  await pinLogo(page);
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(sheet ? 3200 : 800); // the sheet appears 2.5 s after load
  await page.waitForTimeout(300);
  if (sheet) await page.waitForSelector('.a2hs');
  return { ctx, page };
}

const layout = { vw: VW, vh: VH };
const browser = await chromium.launch({ executablePath: CHROME });

// ───────── the clean home page (3×): what the sheet rises over ─────────
{
  const { ctx, page } = await open(browser, { dsf: 3, ua: UA.ios, sheet: false });
  await page.screenshot({ path: out('home-3x.png') });
  layout.home = { header: await box(page.locator('.shell-header')), fan: await box(page.locator('.fan-stage')) };
  await ctx.close();
}

// ───────── the sheet, iPhone Safari (full frame 3× for reference + 4× cutout) ─────────
{
  const { ctx, page } = await open(browser, { dsf: 3, ua: UA.ios, sheet: true });
  await page.screenshot({ path: out('home-sheet-3x.png') });
  await ctx.close();
}
{
  const { ctx, page } = await open(browser, { dsf: 4, ua: UA.ios, sheet: true });
  const sheet = page.locator('.a2hs');
  await sheet.screenshot({ path: out('sheet-ios-4x.png') });
  const steps = page.locator('.a2hs-steps > li');
  const s = [];
  for (let i = 0; i < (await steps.count()); i++) s.push({ box: await box(steps.nth(i)), icon: await box(steps.nth(i).locator('.a2hs-ico')), text: (await steps.nth(i).innerText()).replace(/\s+/g, ' ').trim() });
  layout.sheetIos = {
    box: await box(sheet),
    tile: await box(page.locator('.a2hs-tile')),
    tileLabel: await box(page.locator('.a2hs-tile-label')),
    title: await box(page.locator('#a2hs-title')),
    sub: await box(page.locator('.a2hs-sub')),
    steps: s,
    later: await box(page.locator('.a2hs-later')),
    never: await box(page.locator('.a2hs-never')),
    close: await box(page.locator('.a2hs-close')),
  };
  await ctx.close();
}

// ───────── the sheet, Android Chrome with the one-tap button (4× cutout) ─────────
{
  const { ctx, page } = await open(browser, { dsf: 4, ua: UA.android, sheet: true, android: true });
  await page.waitForSelector('.a2hs-install');
  const sheet = page.locator('.a2hs');
  await sheet.screenshot({ path: out('sheet-android-4x.png') });
  layout.sheetAndroid = { box: await box(sheet), tile: await box(page.locator('.a2hs-tile')), install: await box(page.locator('.a2hs-install')), later: await box(page.locator('.a2hs-later')) };
  await ctx.close();
}

await browser.close();
fs.writeFileSync(LAYOUT, JSON.stringify(layout, null, 1));
console.log(JSON.stringify(layout, null, 1));
