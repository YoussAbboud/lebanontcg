// Loads the film's template in Chromium at 1920x1080, seeks the timeline, and prints the
// centres of the tap targets so build_film.py's TAPS match the real layout.
import pw from '/home/user/lebanontcg/node_modules/playwright-core/index.js';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const comp = path.join(here, 'composition');
const film = fs.readFileSync(path.join(comp, 'compositions', 'film.html'), 'utf8');
const inner = film.replace(/^\s*<template>/, '').replace(/<\/template>\s*$/, '');
const B = 0.6;
const at = Number(process.argv[2] ?? 24) * B;
const page = `<!doctype html><html><head><meta charset="utf-8"><script src="assets/vendor/gsap.min.js"></script>
<style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#08090b}</style></head>
<body><script>window.__timelines={}</script>${inner}</body></html>`;
fs.writeFileSync(path.join(comp, '_probe.html'), page);

const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto('file://' + path.join(comp, '_probe.html'));
await p.waitForTimeout(300);
const out = await p.evaluate((t) => {
  const tl = window.__timelines.film;
  tl.seek(t, false);
  const c = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2), Math.round(r.width), Math.round(r.height)]; };
  return { pub: c('#pub'), rw: c('#rw'), k1: c('#k1'), cool: c('#cool'), susp: c('#susp'), c1: c('#c1 .big'), c2: c('#c2 .mid'), out: document.documentElement.scrollWidth };
}, at);
console.log(JSON.stringify(out));
if (process.argv[3]) await p.screenshot({ path: process.argv[3] });
await browser.close();
fs.unlinkSync(path.join(comp, '_probe.html'));
