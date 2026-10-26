// capture.mjs — real-page textures for the LebanonTCG promo (stage 4).
// Adapted from video-shotcraft assets/scripts/capture-template.mjs (Puppeteer → Playwright, same three outputs):
//   1. full-page 2x screenshots   2. per-element cutouts (+4x hero textures)   3. layout.json (page-space bboxes)
//
// Source: the project's OFFLINE MOCK BUILD (VITE_MOCK=1) served locally. Every handle, listing and message is
// fictional seed data from src/mock/seed.ts. The mock-only "DEV" user switcher is hidden before every capture.
// Time is frozen with Playwright's clock so the auction countdown and "time ago" labels are reproducible.
//
// Usage: node capture/capture.mjs  (mock build served at BASE)
import pw from '/home/user/lebanontcg/node_modules/playwright-core/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { chromium } = pw;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = {
  BASE: 'http://localhost:4319',
  OUT_DIR: path.join(HERE, '../public/textures/live'),
  LAYOUT_JSON: path.join(HERE, '../src/live-layout.json'),
  CHROME: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  NOW: new Date('2026-10-24T17:20:00+03:00'), // a Saturday-eve in Beirut; any fixed instant works
  SETTLE_MS: 700,
};
fs.mkdirSync(CONFIG.OUT_DIR, { recursive: true });
const out = (f) => path.join(CONFIG.OUT_DIR, f);

const HIDE_DEV = `.uswitch, .uswitch-btn, [class*="uswitch"] { visibility: hidden !important; }`;

async function newPage(browser, { width = 1920, height = 1080, dsf = 2 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.clock.install({ time: CONFIG.NOW });
  await page.goto(CONFIG.BASE + '/');
  await page.waitForSelector('.shell-header');
  await page.addStyleTag({ content: HIDE_DEV });
  return { ctx, page };
}
const settle = async (page, ms = CONFIG.SETTLE_MS) => {
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(ms); // let timers (realtime fakes, presence) tick on the frozen clock
  await page.waitForTimeout(250);
};
const go = async (page, url) => {
  await page.evaluate((u) => { history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate')); }, url);
  await settle(page);
};
const signIn = async (page, handle) => {
  // the switcher is hidden from captures but still clickable through evaluate
  await page.evaluate(() => document.querySelector('.uswitch-btn')?.click());
  await page.waitForTimeout(150);
  await page.evaluate((h) => {
    const item = [...document.querySelectorAll('.uswitch-item')].find((e) => e.textContent?.includes(h));
    item?.click();
  }, handle);
  await settle(page, 400);
};
const box = async (loc) => {
  const b = await loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; });
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * 100) / 100]));
};
const fullShot = async (page, file) => {
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: out(file), fullPage: true });
  return page.evaluate(() => document.documentElement.scrollHeight);
};

const layout = { pageW: 1920 };
const browser = await chromium.launch({ executablePath: CONFIG.CHROME });

// ───────── Browse (signed in as Maya, the seller in the chat later) ─────────
{
  const { ctx, page } = await newPage(browser);
  await signIn(page, '@mayapulls');
  await go(page, '/browse');
  const pageH = await fullShot(page, 'browse-full.png');
  const cards = page.locator('.lcard');
  const n = await cards.count();
  const list = [];
  for (let i = 0; i < n; i++) {
    const c = cards.nth(i);
    const b = await box(c);
    const file = `card${i + 1}.png`;
    await c.screenshot({ path: out(file) });
    list.push({ file, ...b, title: (await c.locator('.lcard-title').textContent())?.trim() });
  }
  const header = await box(page.locator('.shell-header'));
  await page.locator('.shell-header').screenshot({ path: out('nav.png') });
  const frame = await box(page.locator('.shell-frame'));
  const search = page.locator('input[type="search"], .browse-search input, input[placeholder*="Search"]').first();
  let searchBox = null;
  if (await search.count()) {
    const holder = search.locator('xpath=..');
    searchBox = await box(holder);
    await holder.screenshot({ path: out('float-search.png') });
  }
  // empty plate: every listing card hidden, page geometry unchanged
  await page.addStyleTag({ content: '.lcard { visibility: hidden !important; }' });
  await settle(page, 200);
  await fullShot(page, 'browse-empty.png');
  layout.browse = { pageH, frame, header, search: searchBox, cards: list };
  await ctx.close();
}

// hero card at 4x for close-ups (Q2): the live Red-Eyes auction card
{
  const { ctx, page } = await newPage(browser, { dsf: 4 });
  await signIn(page, '@mayapulls');
  await go(page, '/browse');
  const hero = page.locator('.lcard', { hasText: 'Red-Eyes B. Dragon LOB 1st Edition' }).first();
  await hero.screenshot({ path: out('hero-hires.png') });
  layout.browse.heroTitle = 'Red-Eyes B. Dragon LOB 1st Edition';
  await ctx.close();
}

// ───────── Live auction with a late bid (the anti-snipe extension) ─────────
async function auctionState(dsf) {
  const { ctx, page } = await newPage(browser, { dsf });
  // the mock auction a-1 ends 6 min after load; bids are placed on the frozen clock
  await page.clock.runFor(4 * 60_000 + 30_000); // 1:30 left
  await signIn(page, '@ritacollects');
  await go(page, '/listing/l-auc-1');
  await page.locator('.aucpanel-bidrow input').fill('250');
  await page.locator('.aucpanel-bidrow button').first().click();
  await settle(page, 400);
  await page.clock.runFor(48_000); // ~41 s left: inside the final minute
  await signIn(page, '@karim_tcg');
  await go(page, '/listing/l-auc-1');
  await page.locator('.aucpanel-bidrow input').fill('300');
  await page.locator('.aucpanel-bidrow button').first().click();
  await settle(page, 900);
  return { ctx, page };
}
{
  const { ctx, page } = await auctionState(2);
  const pageH = await fullShot(page, 'listing-full.png');
  layout.listing = {
    pageH,
    panel: await box(page.locator('.aucpanel')),
    head: await box(page.locator('.aucpanel-head')),
    clock: await box(page.locator('.aucpanel-clock')),
    history: await box(page.locator('.aucpanel-history')),
    extendNote: (await page.locator('.aucpanel-extend').count()) ? await box(page.locator('.aucpanel-extend').first()) : null,
    countdown: (await page.locator('.aucpanel-countdown').textContent())?.trim(),
    price: (await page.locator('.aucpanel-price').textContent())?.trim(),
  };
  await page.locator('.aucpanel').screenshot({ path: out('auction-panel.png') });
  await ctx.close();
}
{
  const { ctx, page } = await auctionState(4);
  await page.locator('.aucpanel').screenshot({ path: out('auction-hires.png') });
  await ctx.close();
}

// ───────── Chat: the seeded deal thread, from Maya's side ─────────
{
  const { ctx, page } = await newPage(browser);
  await signIn(page, '@mayapulls');
  await go(page, '/chat/c-1');
  // the thread is its own scroll box; show its latest messages (the deal and the offer), as the app does on open
  await page.evaluate(() => { const l = document.querySelector('.chat-log'); if (l) l.scrollTop = l.scrollHeight; });
  await settle(page, 300);
  const pageH = await fullShot(page, 'chat-full.png');
  const log = await box(page.locator('.chat-log'));
  const bubbles = page.locator('.chat-bubble');
  const n = await bubbles.count();
  const rows = [];
  for (let i = 0; i < n; i++) {
    const b = bubbles.nth(i);
    const bb = await box(b);
    if (bb.y < log.y || bb.y + bb.h > log.y + log.h) continue; // only rows fully visible in the thread
    const file = `bubble${i + 1}.png`;
    await b.screenshot({ path: out(file) });
    const cls = (await b.getAttribute('class')) ?? '';
    rows.push({ file, ...bb, kind: cls.includes('offer') ? 'offer' : cls.includes('mine') ? 'mine' : 'theirs' });
  }
  layout.chat = { pageH, log, thread: await box(page.locator('.chat-thread')), head: await box(page.locator('.chat-thread-head')), rows };
  await ctx.close();
}

// ───────── Pre-Grade: the eight guided capture slots (1560-wide window for the scan shot) ─────────
{
  const { ctx, page } = await newPage(browser, { width: 1560, height: 880 });
  await signIn(page, '@mayapulls');
  await go(page, '/pregrade');
  const pageH = await fullShot(page, 'pregrade-full.png');
  const slots = page.locator('.pregrade-slot');
  const n = await slots.count();
  const list = [];
  for (let i = 0; i < n; i++) {
    const s = slots.nth(i);
    const file = `slot${i + 1}.png`;
    await s.screenshot({ path: out(file) });
    list.push({ file, ...(await box(s)), label: (await s.locator('.pregrade-slot-label').textContent())?.trim() });
  }
  const h1 = page.locator('main h1').first();
  layout.pregrade = { pageW: 1560, pageH, heading: await box(h1), slots: list };
  await ctx.close();
}

await browser.close();
fs.writeFileSync(CONFIG.LAYOUT_JSON, JSON.stringify(layout, null, 2));
console.log(JSON.stringify({
  browse: { pageH: layout.browse.pageH, cards: layout.browse.cards.length, search: !!layout.browse.search },
  listing: { pageH: layout.listing.pageH, countdown: layout.listing.countdown, price: layout.listing.price, extended: !!layout.listing.extendNote },
  chat: { pageH: layout.chat.pageH, rows: layout.chat.rows.map((r) => r.kind) },
  pregrade: { pageH: layout.pregrade.pageH, slots: layout.pregrade.slots.length },
}, null, 1));
