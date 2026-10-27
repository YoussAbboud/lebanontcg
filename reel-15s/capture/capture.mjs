// capture.mjs — real-page textures for the LebanonTCG 15s reel (video-shotcraft stage 4).
// Mobile layout (390-wide viewport, the site's own responsive UI) because the reel is 9:16: the page fills the frame
// edge to edge at 1080/390 = 2.77×, no device mockup.
//
// Source: by default the project's OFFLINE MOCK BUILD (VITE_MOCK=1) served on localhost — every handle, listing and
// message is fictional seed data (src/mock/seed.ts) and the card art is the site's own placeholder art. To capture the
// live site instead (e.g. once listings carry licensed card photos), run with BASE=https://www.lebanontcg.com; the
// selectors are the same. The mock-only "DEV" user switcher is hidden; time is frozen so countdowns are reproducible.
//
// Outputs: public/textures/*.png and src/layout.json (page-space boxes in CSS px).
// Usage: npm run capture   (mock build served on :4319 — `VITE_MOCK=1 npx vite build` in the repo root, then any static
//        server with SPA fallback)  ·  BASE=https://www.lebanontcg.com npm run capture   (live site)
import pw from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { chromium } = pw;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://localhost:4319';
const MOCK = !process.env.BASE;
const OUT = path.join(HERE, '../public/textures');
const LAYOUT = path.join(HERE, '../src/layout.json');
// a Chromium binary for playwright-core (CHROME=…); the default is the one in this build container
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const NOW = new Date('2026-10-24T17:20:00+03:00');
const VW = 390;
const VH = 693; // 1920 / (1080 / 390): the CSS height one reel frame shows
fs.mkdirSync(OUT, { recursive: true });
const out = (f) => path.join(OUT, f);

// opening: one card per game, captured as each listing's own card-shaped photo (front card first: it is also the first
// listing on Browse, where the portal opens). The scroll target is a different seller and colour from the first card,
// ~2 frame heights down the feed; it opens into its listing page.
const OPENING = [
  { id: 'l-auc-8', title: 'Venusaur Base Set Shadowless' }, // Pokémon
  { id: 'l-auc-2', title: 'Dark Magician 1st Edition — LOB' }, // Yu-Gi-Oh!
  { id: 'l-auc-4', title: 'Grief — Modern Horizons 2 Foil' }, // Magic: The Gathering
];
const TARGET = 'Red-Eyes B. Dragon LOB 1st Edition';
const TARGET_ID = 'l-auc-6';

// display:none (not visibility): the mock-only user switcher must not take header space the live site doesn't give it
const HIDE = `.uswitch, .uswitch-btn, [class*="uswitch"] { display: none !important; }
.lcard { content-visibility: visible !important; contain-intrinsic-size: auto !important; }`;

// the header logo is an animated GIF (a spinning flag card): pin it to its own face-on first frame so no capture
// catches it edge-on
const LOGO_FRAME0 = 'data:image/png;base64,' + fs.readFileSync(path.join(HERE, 'logo-frame0.png')).toString('base64');
const pinLogo = (page) => page.evaluate((src) => document.querySelectorAll('.shell-logo-gif').forEach((i) => { i.src = src; }), LOGO_FRAME0);

async function newPage(browser, dsf) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.clock.install({ time: NOW });
  await page.goto(BASE + '/');
  await page.waitForSelector('.shell-header');
  await page.addStyleTag({ content: HIDE });
  await pinLogo(page);
  return { ctx, page };
}
const settle = async (page, ms = 700) => {
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(ms);
  await page.waitForTimeout(250);
};
const go = async (page, url) => {
  await page.evaluate((u) => { history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate')); }, url);
  await settle(page);
  await page.addStyleTag({ content: HIDE });
  await pinLogo(page);
};
// card art is drawn when a card enters the viewport: walk the page once so every card has painted
const warmScroll = async (page) => {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += VH / 2) {
    await page.evaluate((yy) => scrollTo(0, yy), y);
    await page.clock.runFor(120);
    await page.waitForTimeout(40);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await settle(page, 300);
};
const signIn = async (page, handle) => {
  if (!MOCK) return; // the live site is captured signed out
  await page.evaluate(() => document.querySelector('.uswitch-btn')?.click());
  await page.waitForTimeout(150);
  await page.evaluate((h) => [...document.querySelectorAll('.uswitch-item')].find((e) => e.textContent?.includes(h))?.click(), handle);
  await settle(page, 400);
};
// Every capture context starts from the same fresh mock state, signed in as a collector (header shows an avatar).
const prepState = async (page) => {
  await signIn(page, '@ritacollects');
  await go(page, '/browse');
};
const box = (loc) => loc.evaluate((e) => {
  const r = e.getBoundingClientRect();
  return { x: Math.round((r.x + scrollX) * 100) / 100, y: Math.round((r.y + scrollY) * 100) / 100, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 };
});
const clipShot = async (page, file, y0, y1) => {
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: out(file), fullPage: true, clip: { x: 0, y: y0, width: VW, height: y1 - y0 } });
};

const layout = { vw: VW, vh: VH };
const browser = await chromium.launch({ executablePath: CHROME });

// ───────── Browse (signed in: the header shows a collector, not "Sign in") ─────────
for (const dsf of [1, 3, 4]) {
  const { ctx, page } = await newPage(browser, dsf);
  await prepState(page);
  await go(page, '/browse');
  await warmScroll(page);
  const cards = page.locator('.lcard');
  const all = [];
  for (let i = 0; i < (await cards.count()); i++) {
    const c = cards.nth(i);
    all.push({ i, title: (await c.locator('.lcard-title').textContent())?.trim(), ...(await box(c)), face: await box(c.locator('.lcard-facewrap')) });
  }
  const target = all.find((c) => c.title === TARGET);
  if (dsf === 1) {
    // base layer for the fast scroll (shown only while motion-blurred): top of page → below the target
    const pageH = Math.ceil(target.y + target.h + VH);
    await clipShot(page, 'browse-1x.png', 0, pageH);
    layout.browse = { pageH, header: await box(page.locator('.shell-header')), cards: all.slice(0, target.i + 3), target: target.i };
  }
  if (dsf === 3) {
    // read-sharp tiles: the top screen (+ a margin) and the screen around the target
    const topH = VH + 120;
    const t0 = Math.floor(target.y - VH / 2 - 160);
    const t1 = Math.ceil(target.y + target.h + VH / 2 + 160);
    await clipShot(page, 'browse-top-3x.png', 0, topH);
    await clipShot(page, 'browse-target-3x.png', t0, t1);
    await cards.nth(target.i).screenshot({ path: out('target-card-3x.png') });
    await cards.nth(target.i).locator('.lcard-facewrap').screenshot({ path: out('target-face-3x.png') });
    layout.browse.tiles = { top: { y: 0, h: topH }, target: { y: t0, h: t1 - t0 } };
  }
  if (dsf === 4) {
    // opening cards: each listing's card-shaped photo, hi-res (shown up to ~2× its CSS size)
    layout.opening = [];
    for (const o of OPENING) {
      await go(page, `/listing/${o.id}`);
      const face = page.locator('.livebid-face');
      const file = `open-${layout.opening.length + 1}.png`;
      await face.screenshot({ path: out(file) });
      const b = await box(face);
      layout.opening.push({ file, title: o.title, w: b.w, h: b.h });
    }
  }
  await ctx.close();
}

// ───────── Listing page of the target: a live auction with two bids, seen by a signed-in collector ─────────
{
  const { ctx, page } = await newPage(browser, 3);
  await prepState(page);
  await go(page, `/listing/${TARGET_ID}`);
  await warmScroll(page);
  await page.evaluate(() => scrollTo(0, 0));
  const pageH = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({ path: out('listing-3x.png'), fullPage: true });
  layout.listing = {
    pageH,
    face: await box(page.locator('.livebid-face')),
    photo: await box(page.locator('.livebid-photo')),
    title: await box(page.locator('.livebid-title')),
    panel: await box(page.locator('.aucpanel')),
    banner: await box(page.locator('.livebid-banner')),
  };
  await page.locator('.livebid-face').screenshot({ path: out('listing-face-3x.png') });
  await ctx.close();
}

await browser.close();
fs.writeFileSync(LAYOUT, JSON.stringify(layout, null, 1));
console.log(JSON.stringify({ browseH: layout.browse.pageH, target: layout.browse.cards[layout.browse.target], tiles: layout.browse.tiles, listing: layout.listing }, null, 1));
