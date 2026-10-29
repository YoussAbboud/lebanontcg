"""Writes composition/index.html and composition/compositions/film.html.

"Stamped": the junk photo fills the frame and the three outcomes land on it as rubber stamps —
the check's verdict, the cooldown, the suspension — each in the site's own words, with a
moderation log ticking underneath. One continuous scene; every cue is a beat at 90 BPM
(B = 2/3 s), written as T(n); the soundtrack (work/synth.py) uses the same beat numbers.
"""
import os

HERE = os.path.dirname(__file__)
COMP = os.path.join(HERE, 'composition')
BPM = 90
B = 60 / BPM
BEATS = 34
DUR = round(BEATS * B, 4)


def T(n):
    return round(n * B, 4)


CSS = """
    @font-face { font-family: 'Chakra Petch'; font-weight: 700; src: url('assets/fonts/chakra-petch-latin-700-normal.woff2') format('woff2'); }
    @font-face { font-family: 'LTCG Sans'; font-weight: 400; src: url('assets/fonts/inter-latin-400-normal.woff2') format('woff2'); }
    @font-face { font-family: 'LTCG Sans'; font-weight: 600; src: url('assets/fonts/inter-latin-600-normal.woff2') format('woff2'); }
    @font-face { font-family: 'LTCG Mono'; font-weight: 500; src: url('assets/fonts/jetbrains-mono-latin-500-normal.woff2') format('woff2'); }
    @font-face { font-family: 'LTCG Mono'; font-weight: 700; src: url('assets/fonts/jetbrains-mono-latin-700-normal.woff2') format('woff2'); }
    #root { position: absolute; inset: 0; overflow: hidden; background: #08090b; font-family: 'LTCG Sans', sans-serif; color: #f2f5f7; }
    .mono { font-family: 'LTCG Mono', monospace; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; }
    .display { font-family: 'Chakra Petch', sans-serif; font-weight: 700; text-transform: uppercase; }

    /* ---- the photo, full bleed ------------------------------------------------------------- */
    #shake { position: absolute; inset: 0; }
    #photo { position: absolute; inset: 0; overflow: hidden; z-index: 0; }
    #photo img { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; object-fit: cover; object-position: 50% 42%; transform-origin: 50% 45%; }
    #vig { position: absolute; inset: 0; z-index: 1; background:
      linear-gradient(to bottom, rgba(8, 9, 11, 0.92) 0%, rgba(8, 9, 11, 0.35) 30%, rgba(8, 9, 11, 0.1) 52%, rgba(8, 9, 11, 0.55) 78%, rgba(8, 9, 11, 0.96) 100%); }
    #tint { position: absolute; inset: 0; z-index: 2; background: #ff5c8a; mix-blend-mode: multiply; opacity: 0; }

    /* ---- the headline, top, inside the title-safe box -------------------------------------- */
    .hl { position: absolute; z-index: 3; left: 60px; top: 250px; width: 960px; font-size: 100px; line-height: 1.0; letter-spacing: 0.01em; opacity: 0; }
    .hl.mid { font-size: 72px; line-height: 1.04; }
    .hl .sm { display: block; margin-top: 22px; font-size: 30px; line-height: 1.4; color: #d6ff3f; letter-spacing: 0.1em; }
    #h5 .sm { color: #ff5c8a; }
    #strikes { position: absolute; z-index: 3; left: 60px; top: 176px; display: flex; align-items: center; gap: 16px; }
    #strikes .lab { font-size: 28px; color: #b9c2cc; margin-right: 6px; }
    .sdot { width: 32px; height: 32px; border-radius: 50%; border: 3px solid rgba(255, 255, 255, 0.35); background: rgba(8, 9, 11, 0.5); }

    /* ---- the listing's own words, bottom left ---------------------------------------------- */
    #lst { position: absolute; z-index: 3; left: 60px; top: 1180px; width: 960px; }
    #lst .t { font-size: 60px; line-height: 1.3; white-space: nowrap; }
    .typed { display: inline-block; overflow: hidden; white-space: nowrap; vertical-align: bottom; font-family: 'LTCG Mono', monospace; font-weight: 700; }
    #lst .m { margin-top: 12px; font-size: 28px; color: #b9c2cc; }
    #lst .tag { display: inline-flex; align-items: center; height: 48px; padding: 0 20px; margin-top: 16px; border-radius: 999px; border: 2px solid #ffc45e; color: #ffc45e; font-size: 26px; opacity: 0; }
    #lst .only { margin-top: 12px; font-size: 28px; color: #ffc45e; opacity: 0; }
    #lst2 { position: absolute; left: 0; top: 0; width: 100%; opacity: 0; }

    /* ---- the stamps ------------------------------------------------------------------------ */
    .stamp { position: absolute; left: 50%; top: 50%; z-index: 5; padding: 26px 40px; border: 10px double currentColor; border-radius: 18px;
      text-align: center; white-space: nowrap; opacity: 0; background: rgba(8, 9, 11, 0.22); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5); }
    .stamp .a { font-size: 78px; line-height: 1; }
    .stamp .b { margin-top: 14px; font-size: 28px; letter-spacing: 0.12em; }
    #s1, #s2 { color: #ff5c8a; }
    #s1 { margin-top: -150px; }
    #s2 { margin-top: 40px; }
    #s3 { color: #ffc45e; white-space: normal; width: 900px; padding: 34px 44px; }
    #s3 .a { font-size: 66px; line-height: 1.05; }
    #s3 .b { font-size: 36px; line-height: 1.3; margin-top: 18px; letter-spacing: 0.06em; }
    #s3 .b .sec { display: inline-grid; }
    #s3 .b .sec span { grid-area: 1 / 1; opacity: 0; }
    #s4 { color: #ff5c8a; white-space: normal; width: 940px; padding: 40px 44px; border-width: 12px; }
    #s4 .a { font-size: 104px; line-height: 0.98; }
    #s4 .b { font-size: 28px; line-height: 1.35; margin-top: 22px; color: #f2f5f7; letter-spacing: 0.08em; }

    /* ---- the moderation log, above the listing --------------------------------------------- */
    #log { position: absolute; z-index: 3; left: 60px; top: 1440px; width: 960px; font-size: 28px; line-height: 1.5; color: #b9c2cc; }
    #log div { opacity: 0; white-space: nowrap; }
    #log b { color: #f2f5f7; font-weight: 500; }
    #log .no { color: #ff5c8a; }
    #log .warn { color: #ffc45e; }

    /* ---- the outro ------------------------------------------------------------------------- */
    #out { position: absolute; inset: 0; background: #08090b; opacity: 0; z-index: 25; }
    #nojunk { position: absolute; left: 0; right: 0; top: 870px; text-align: center; font-size: 170px; line-height: 1; color: #d6ff3f; opacity: 0; }
    #lock { position: absolute; left: 0; right: 0; top: 640px; display: flex; flex-direction: column; align-items: center; gap: 34px; opacity: 0; }
    #lock img { width: 170px; height: 170px; }
    #lock .w { font-size: 112px; line-height: 1; letter-spacing: 0.04em; }
    #tag { position: absolute; left: 60px; right: 60px; top: 1130px; text-align: center; font-size: 30px; line-height: 1.6; letter-spacing: 0.14em; color: #b9c2cc; opacity: 0; }
    #url { position: absolute; left: 0; right: 0; top: 1280px; text-align: center; font-size: 40px; letter-spacing: 0.05em; text-transform: none; color: #d6ff3f; opacity: 0; }
"""

SECS = [57, 56, 55, 54]
BODY = f"""
    <div id="shake">
      <div id="photo"><img id="pic" src="assets/img/fan.jpg" alt="" /></div>
      <div id="vig"></div>
      <div id="tint"></div>

      <div id="strikes"><span class="lab mono">Strikes</span><span class="sdot" id="d1"></span><span class="sdot" id="d2"></span><span class="sdot" id="d3"></span></div>

      <div class="hl display" id="h1">Listed as a Charizard.</div>
      <div class="hl display mid" id="h2">Every listing is checked before it goes live.<span class="sm mono" id="h2s">Not a card? Nobody sees it.</span></div>
      <div class="hl display" id="h3">They try again.</div>
      <div class="hl display mid" id="h4">Two in a row? Ten minutes on the bench.<span class="sm mono">The clock is on their screen.</span></div>
      <div class="hl display" id="h5a">They keep going.</div>
      <div class="hl display mid" id="h5">Three warnings. Suspended.<span class="sm mono">On the spot — no reload, no way around it.</span></div>

      <div id="log">
        <div id="l1"><b>12:04:11</b> · Check: <span class="no">not a card</span> · listing in review</div>
        <div id="l2"><b>12:05:38</b> · Check: <span class="no">not a card</span> · listing in review</div>
        <div id="l3"><b>12:05:39</b> · <span class="warn">Listing cooldown</span> · 10 minutes</div>
        <div id="l4"><b>12:16:02</b> · Moderator · Rejected listing</div>
        <div id="l5"><b>12:16:02</b> · Moderator · Warned user · <span class="warn">3 of 3</span></div>
        <div id="l6"><b>12:16:03</b> · Moderator · <span class="no">Suspended user</span></div>
      </div>

      <div id="lst">
        <div id="lst1">
          <div class="t display"><span class="typed" id="t1">CHARIZARD HOLO</span></div>
          <div class="m mono" id="m1" data-layout-ignore>$320 · Pokémon · Base Set · @junkdealer</div>
        </div>
        <div id="lst2">
          <div class="t display"><span class="typed" id="t2">RARE PIKACHU</span></div>
          <div class="m mono" id="m2" data-layout-ignore>$50 · Pokémon · Base Set · @junkdealer</div>
        </div>
        <div class="tag mono" id="tag1" data-layout-ignore>In review</div>
        <div class="only mono" id="only1" data-layout-ignore>Only you can see this listing for now.</div>
      </div>

      <div class="stamp display" id="s1" data-layout-allow-overlap data-layout-allow-occlusion><div class="a" data-layout-allow-occlusion>Check: not a card</div><div class="b mono">The photos do not show a trading card.</div></div>
      <div class="stamp display" id="s2" data-layout-allow-overlap data-layout-allow-occlusion><div class="a" data-layout-allow-occlusion>Check: not a card</div></div>
      <div class="stamp display" id="s3" data-layout-allow-overlap><div class="a">You can't list at the moment.</div><div class="b mono">Try again in 9 minutes <span class="sec">{''.join(f'<span id="s{s}">{s}</span>' for s in SECS)}</span> seconds.</div></div>
      <div class="stamp display" id="s4" data-layout-allow-overlap><div class="a">Your account is suspended.</div><div class="b mono">You can't list, message, like, bid, report or review.</div></div>
    </div>

    <div id="out">
      <div id="nojunk" class="display">No junk.</div>
      <div id="lock"><img src="assets/img/flag.png" alt="" /><div class="w display">LebanonTCG.</div></div>
      <div id="tag" class="mono">We connect collectors. You handle the deal.</div>
      <div id="url" class="mono">www.lebanontcg.com</div>
    </div>"""


def js():
    L = []
    a = L.append

    def typing(sel, text, n0, step_beats):
        a(f"      tl.set('{sel}', {{ width: '0ch' }}, 0);")
        for i in range(1, len(text) + 1):
            a(f"      tl.set('{sel}', {{ width: '{i}ch' }}, {T(n0 + (i - 1) * step_beats)});")

    def hl_in(sel, n):
        a(f"      tl.fromTo('{sel}', {{ opacity: 0, y: 40, scale: 1.08, filter: 'blur(8px)' }}, {{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.3, ease: 'expo.out' }}, {T(n)});")

    def hl_out(sel, n):
        a(f"      tl.to('{sel}', {{ opacity: 0, y: -40, duration: 0.2, ease: 'power2.in' }}, {T(n) - 0.2:.4f});")

    def stamp(sel, n, rot, scale_from=1.7):
        """Slams in from above the paper, over-rotated, and settles."""
        a(f"      tl.set('{sel}', {{ xPercent: -50, yPercent: -50 }}, 0);")
        a(f"      tl.fromTo('{sel}', {{ opacity: 0, scale: {scale_from}, rotation: {rot - 6}, xPercent: -50, yPercent: -50 }}, {{ opacity: 1, scale: 1, rotation: {rot}, xPercent: -50, yPercent: -50, duration: 0.16, ease: 'power4.in', immediateRender: false }}, {T(n) - 0.16:.4f});")
        a(f"      tl.fromTo('#shake', {{ x: 0, y: 0 }}, {{ x: -14, y: 10, duration: 0.05, yoyo: true, repeat: 5, ease: 'none', immediateRender: false }}, {T(n)});")

    def shrink(sel, n, x, y, s, rot, sub=False):
        a(f"      tl.to('{sel}', {{ x: {x}, y: {y}, scale: {s}, rotation: {rot}, opacity: 0.85, duration: 0.4, ease: 'power3.inOut' }}, {T(n)});")
        if sub:  # the sentence would shrink below reading size; the big line is the record
            a(f"      tl.to('{sel} .b', {{ opacity: 0, duration: 0.2 }}, {T(n)});")

    def strike(k, n):
        a(f"      tl.to('#d{k}', {{ backgroundColor: '#ff5c8a', borderColor: '#ff5c8a', boxShadow: '0 0 22px rgba(255, 92, 138, 0.8)', duration: 0.12 }}, {T(n)});")
        a(f"      tl.fromTo('#d{k}', {{ scale: 1.5 }}, {{ scale: 1, duration: 0.4, ease: 'back.out(2)', immediateRender: false }}, {T(n)});")

    def log(sel, n):
        a(f"      tl.fromTo('{sel}', {{ opacity: 0, x: -20 }}, {{ opacity: 1, x: 0, duration: 0.22, ease: 'expo.out' }}, {T(n)});")

    a("      // ---- 1 · The listing (0-4): the photo pushes in, the title types, the line lands on 1 ------")
    a(f"      tl.fromTo('#pic', {{ scale: 1.12 }}, {{ scale: 1.0, duration: {T(4):.3f}, ease: 'power2.out' }}, 0);")
    a("      tl.fromTo('#strikes', { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.2);")
    typing('#t1', 'CHARIZARD HOLO', 0.5, 0.0714)
    a(f"      tl.fromTo('#m1', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.2 }}, {T(1.75)});")
    hl_in('#h1', 1)

    a("      // ---- 2 · Strike one (4-11) ------------------------------------------------------------")
    stamp('#s1', 4, -7)
    strike(1, 4)
    log('#l1', 4.5)
    a(f"      tl.to('#pic', {{ filter: 'saturate(0.2) brightness(0.55)', duration: 0.4 }}, {T(6)});")
    a(f"      tl.fromTo('#tag1', {{ opacity: 0, scale: 0.8, transformOrigin: '0% 50%' }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }}, {T(6)});")
    a(f"      tl.fromTo('#only1', {{ opacity: 0, y: 10 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'expo.out' }}, {T(6.5)});")
    hl_out('#h1', 6.5)
    hl_in('#h2', 6.5)
    a(f"      tl.set('#h2s', {{ opacity: 0 }}, 0);")
    a(f"      tl.fromTo('#h2s', {{ opacity: 0, y: 12 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'expo.out' }}, {T(8)});")

    a("      // ---- 3 · Strike two (11-19): the stamp moves aside, a new listing, the same answer ------")
    hl_out('#h2', 11)
    hl_in('#h3', 11)
    shrink('#s1', 11, -240, -210, 0.45, -9, sub=True)
    a(f"      tl.to('#pic', {{ filter: 'saturate(1) brightness(1)', duration: 0.3 }}, {T(11)});")
    a(f"      tl.to(['#tag1', '#only1'], {{ opacity: 0, duration: 0.15 }}, {T(11)});")
    a(f"      tl.to('#lst1', {{ opacity: 0, y: -16, duration: 0.2 }}, {T(11)});")
    a(f"      tl.fromTo('#lst2', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.1 }}, {T(11)});")
    a(f"      tl.fromTo('#m2', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.2 }}, {T(12.25)});")
    typing('#t2', 'RARE PIKACHU', 11, 0.0833)
    stamp('#s2', 13, 5)
    strike(2, 13)
    log('#l2', 13.5)
    a(f"      tl.to('#pic', {{ filter: 'saturate(0.2) brightness(0.55)', duration: 0.4 }}, {T(13.5)});")
    a(f"      tl.fromTo('#tag1', {{ opacity: 0, scale: 0.8 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)', immediateRender: false }}, {T(13.5)});")
    a("      // beat 15 — the cooldown lands over both verdicts; the seconds tick on the beat")
    shrink('#s2', 15, 240, -400, 0.45, 7)
    stamp('#s3', 15, -3, 1.5)
    log('#l3', 15.5)
    hl_out('#h3', 15)
    hl_in('#h4', 15)
    a(f"      tl.set('#s{SECS[0]}', {{ opacity: 1 }}, 0);")
    for i in range(1, len(SECS)):
        a(f"      tl.set('#s{SECS[i - 1]}', {{ opacity: 0 }}, {T(15 + i)});")
        a(f"      tl.set('#s{SECS[i]}', {{ opacity: 1 }}, {T(15 + i)});")

    a("      // ---- 4 · Strike three (19-27): the moderator's log, then the slam --------------------")
    hl_out('#h4', 20)
    hl_in('#h5a', 20)
    a(f"      tl.to('#s3', {{ opacity: 0, scale: 0.9, duration: 0.25, ease: 'power2.in' }}, {T(19)});")
    log('#l4', 19)
    log('#l5', 20)
    strike(3, 20)
    log('#l6', 21)
    a(f"      tl.to('#tint', {{ opacity: 0.55, duration: 0.12 }}, {T(SLAM := 22)});")
    a(f"      tl.to(['#s1', '#s2', '#lst', '#strikes'], {{ opacity: 0.25, duration: 0.2 }}, {T(22)});")
    stamp('#s4', 22, -4, 1.6)
    hl_out('#h5a', 22.5)
    hl_in('#h5', 22.5)

    a("      // ---- 5 · Outro (27-33) ----------------------------------------------------------------")
    a(f"      tl.to('#out', {{ opacity: 1, duration: 0.15 }}, {T(27) - 0.15:.4f});")
    a(f"      tl.set('#shake', {{ opacity: 0 }}, {T(27)});")
    a(f"      tl.fromTo('#nojunk', {{ opacity: 0, scale: 1.3, filter: 'blur(12px)' }}, {{ opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.3, ease: 'expo.out' }}, {T(27)});")
    a(f"      tl.fromTo('#shake', {{ x: 0, y: 0 }}, {{ x: 10, y: -8, duration: 0.05, yoyo: true, repeat: 3, ease: 'none', immediateRender: false }}, {T(27)});")
    a(f"      tl.to('#nojunk', {{ opacity: 0, scale: 0.9, duration: 0.22, ease: 'power2.in' }}, {T(29.5) - 0.22:.4f});")
    a(f"      tl.fromTo('#lock', {{ opacity: 0, scale: 0.9 }}, {{ opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.4)' }}, {T(29.5)});")
    a(f"      tl.fromTo('#tag', {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }}, {T(30)});")
    a(f"      tl.fromTo('#url', {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }}, {T(30.25)});")
    return '\n'.join(L)


FILM = f"""<template>
  <style>{CSS}
  </style>

  <div id="root" data-composition-id="film" data-width="1080" data-height="1920">{BODY}
  </div>

  <script>
    (function () {{
      // Beats at {BPM} BPM: beat n is at n x {B:.4f} s. The soundtrack uses the same beat numbers.
      const tl = gsap.timeline({{ paused: true }});
{js()}
      window.__timelines['film'] = tl;
    }})();
  </script>
</template>
"""

INDEX = f"""<!doctype html>
<html
  lang="en"
  data-composition-variables='[
    {{"id":"color-ground","type":"color","label":"Background","default":"#08090b"}},
    {{"id":"color-accent","type":"color","label":"Accent","default":"#d6ff3f"}}
  ]'
>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>LebanonTCG stamped</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #08090b; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #08090b; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1920">
      <!-- One continuous scene: the photo stays, the stamps pile up. -->
      <div id="film" data-composition-id="film" data-composition-src="compositions/film.html"
        data-start="0" data-duration="{DUR}" data-track-index="1" data-track-kind="graphics"
        data-width="1080" data-height="1920"></div>
      <!-- Music and effects synthesized together on the {BPM} BPM grid (work/synth.py). -->
      <audio id="soundtrack" class="clip" data-start="0" data-duration="{DUR}" data-track-index="2"
        data-volume="1" src="assets/audio/soundtrack.wav"></audio>
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""

os.makedirs(os.path.join(COMP, 'compositions'), exist_ok=True)
with open(os.path.join(COMP, 'compositions', 'film.html'), 'w') as f:
    f.write(FILM)
with open(os.path.join(COMP, 'index.html'), 'w') as f:
    f.write(INDEX)
print('wrote film.html and index.html;', BEATS, 'beats =', DUR, 's')
