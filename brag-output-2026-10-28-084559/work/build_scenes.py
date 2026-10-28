"""Writes the five scene files into composition/compositions/ — the VERTICAL (1080x1920) cut.

Same story, timing and soundtrack as the landscape cut (brag-output-2026-10-28-082930);
only the layout changes: captions stack above a taller chat panel, the hook's tools stack.


The three chat scenes share one set of chat styles (rebuilt from src/pages/chat.css and the
phone/location components, scaled ~1.6x for a 1080p frame), so they are generated from here
rather than copy-pasted. Times in the GSAP timelines are local seconds; the scene's start on
the 120 BPM grid is noted beside each beat-locked cue (a beat is 0.5 s).
"""
import os

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, 'composition', 'compositions')

FONTS = """
    @font-face { font-family: 'Chakra Petch'; font-weight: 700; src: url('assets/fonts/chakra-petch-latin-700-normal.woff2') format('woff2'); }
    @font-face { font-family: 'LTCG Sans'; font-weight: 400; src: url('assets/fonts/inter-latin-400-normal.woff2') format('woff2'); }
    @font-face { font-family: 'LTCG Sans'; font-weight: 600; src: url('assets/fonts/inter-latin-600-normal.woff2') format('woff2'); }
    @font-face { font-family: 'LTCG Mono'; font-weight: 500; src: url('assets/fonts/jetbrains-mono-latin-500-normal.woff2') format('woff2'); }
    #root { position: absolute; inset: 0; overflow: hidden; background: #0b0c10; font-family: 'LTCG Sans', sans-serif; color: #f2f5f7; }
    .bg {
      position: absolute; inset: 0;
      background:
        radial-gradient(ellipse 1200px 620px at 28% -12%, rgba(123, 92, 255, 0.18), rgba(123, 92, 255, 0) 70%),
        radial-gradient(ellipse 900px 520px at 92% 112%, rgba(214, 255, 63, 0.07), rgba(214, 255, 63, 0) 70%),
        #0b0c10;
    }
    .mono { font-family: 'LTCG Mono', monospace; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; }
    .display { font-family: 'Chakra Petch', sans-serif; font-weight: 700; text-transform: uppercase; }
    svg.ic { display: block; }
"""

CHAT = """
    .stage { position: absolute; inset: 0; }
    .panel {
      position: absolute; left: 60px; top: 640px; width: 960px; height: 1160px; border-radius: 30px; overflow: hidden;
      background: #0e1013; border: 2px solid rgba(255, 255, 255, 0.08); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.9);
    }
    .head { position: absolute; left: 0; right: 0; top: 0; height: 132px; display: flex; align-items: center; gap: 22px; padding: 0 34px; border-bottom: 2px solid rgba(255, 255, 255, 0.06); }
    .thumb { width: 72px; height: 96px; border-radius: 12px; position: relative; flex: none;
      background: radial-gradient(circle at 35% 22%, #ff9d4d, #9b3a12 80%); border: 2px solid rgba(255, 157, 77, 0.6); }
    .thumb b { position: absolute; left: 21px; top: 33px; width: 30px; height: 30px; transform: rotate(45deg); border: 7px solid #ffb35c; background: #5a210a; }
    .who { font-size: 34px; font-weight: 600; display: flex; align-items: center; gap: 14px; }
    .dot { width: 14px; height: 14px; border-radius: 50%; background: #34d399; box-shadow: 0 0 12px rgba(52, 211, 153, 0.7); }
    .sub { font-size: 24px; color: #b9c2cc; margin-top: 8px; }
    /* the taller vertical panel: messages sit lower, nearer the composer, as a chat does */
    .log { position: absolute; left: 34px; right: 34px; top: 300px; bottom: 150px; }
    .bub { position: absolute; border-radius: 24px; padding: 20px 26px 16px; font-size: 30px; line-height: 1.35; max-width: 700px; }
    .theirs { left: 0; background: #16191e; border: 2px solid rgba(255, 255, 255, 0.08); }
    .mine { right: 0; background: #d6ff3f; color: #08090b; }
    .meta { font-size: 18px; margin-top: 10px; color: #7b8590; }
    .mine .meta { color: #4b5512; }
    .pill { position: absolute; left: 0; right: 0; text-align: center; }
    .pill span { display: inline-block; font-size: 24px; color: #b9c2cc; padding: 10px 20px; border-radius: 999px; border: 2px solid rgba(255, 255, 255, 0.1); background: #121418; }
    .card { position: absolute; right: 0; border-radius: 24px; padding: 24px 28px 18px; background: #16191e; border: 2px solid #d6ff3f; }
    .card .k { font-size: 24px; color: #d6ff3f; }
    .composer { position: absolute; left: 34px; right: 34px; bottom: 34px; display: flex; gap: 14px; align-items: center; }
    .tool { width: 76px; height: 76px; border-radius: 50%; border: 2px solid #2a3038; display: flex; align-items: center; justify-content: center; color: #b9c2cc; font-family: 'LTCG Mono', monospace; font-size: 28px; flex: none; }
    .tool.on { border-color: #d6ff3f; color: #d6ff3f; }
    .input { flex: 1; height: 76px; border-radius: 999px; border: 2px solid #2a3038; background: #16191e; color: #7b8590; font-size: 28px; display: flex; align-items: center; padding: 0 30px; }
    .send { height: 76px; padding: 0 34px; border-radius: 999px; background: #8aa324; color: #08090b; display: flex; align-items: center; font-size: 22px; }
    .bar { position: absolute; left: 34px; right: 34px; bottom: 128px; border: 2px solid #d6ff3f; border-radius: 20px; background: #16191e; padding: 20px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }
    .barlab { font-size: 24px; color: #d6ff3f; }
    .field { height: 64px; border-radius: 10px; border: 2px solid #2a3038; background: #0e1013; display: flex; align-items: center; padding: 0 18px; font-size: 28px; color: #f2f5f7; white-space: nowrap; }
    .field.ph { color: #7b8590; }
    .btn { height: 64px; border-radius: 999px; display: inline-flex; align-items: center; gap: 12px; padding: 0 24px; font-size: 22px; white-space: nowrap; }
    .btn.acid { background: #d6ff3f; color: #08090b; }
    .btn.out { border: 2px solid #2a3038; color: #e6eaee; }
    .hint { flex-basis: 100%; font-size: 22px; color: #7b8590; }
    .typed { display: inline-block; overflow: hidden; white-space: nowrap; vertical-align: bottom; font-family: 'LTCG Mono', monospace; }
    .caret { display: inline-block; width: 3px; height: 30px; background: #d6ff3f; margin-left: 4px; vertical-align: middle; }
    .tap { position: absolute; width: 90px; height: 90px; border-radius: 50%; border: 5px solid #d6ff3f; opacity: 0; pointer-events: none; }

    .cap { position: absolute; left: 108px; right: 108px; top: 190px; }
    .cap .k { font-size: 28px; color: #d6ff3f; }
    .cap .h { font-size: 96px; line-height: 0.98; margin-top: 20px; }
    .cap .s { font-size: 42px; line-height: 1.28; color: #c9d0d7; margin-top: 26px; }
"""

DOLLAR = '$'
PHONE = '<svg class="ic" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>'
PIN = '<svg class="ic" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'
MAP = '<svg class="ic" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>'


def ic(tpl, s):
    return tpl.format(s=s)


def head():
    return """
        <div class="head">
          <div class="thumb"><b></b></div>
          <div>
            <div class="who">@mayapulls <span class="dot"></span></div>
            <div class="sub mono" data-layout-ignore>Charizard Base Set Unlimited · Asking $320</div>
          </div>
        </div>"""


def composer(lit):
    on = lambda k: ' on' if k == lit else ''
    return f"""
        <div class="composer">
          <div class="tool{on('offer')}">$</div>
          <div class="tool{on('phone')}">{ic(PHONE, 30)}</div>
          <div class="tool{on('pin')}">{ic(PIN, 30)}</div>
          <div class="input">Write a message</div>
          <div class="send mono">Send</div>
        </div>"""


def caption(pid, num, word, headline, sub):
    return f"""
      <div class="cap" id="{pid}-cap">
        <div class="k mono" id="{pid}-k">{num} · {word}</div>
        <div class="h display" id="{pid}-h">{headline}</div>
        <div class="s" id="{pid}-s">{sub}</div>
      </div>"""


def scene(cid, css, body, script):
    return f"""<template>
  <style>{FONTS}{css}
  </style>

  <div id="root" data-composition-id="{cid}" data-width="1080" data-height="1920">
    <div class="bg"></div>{body}
  </div>

  <script>
    (function () {{
      const tl = gsap.timeline({{ paused: true }});
{script}
      window.__timelines['{cid}'] = tl;
    }})();
  </script>
</template>
"""


def typing(sel, text, start, step):
    """Monospace typing as reversible width steps (no callbacks, so seeking works both ways)."""
    lines = [f"      tl.set('{sel}', {{ width: '0ch' }}, 0);"]
    for i in range(1, len(text) + 1):
        lines.append(f"      tl.set('{sel}', {{ width: '{i}ch' }}, {start + (i - 1) * step:.3f});")
    return '\n'.join(lines)


ENTER = """      // Arrive: up and in (the previous scene left up and out)
      tl.fromTo('.stage', { y: 120, opacity: 0, filter: 'blur(12px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.32, ease: 'expo.out' }, 0);"""


def exit_at(t):
    return f"""      // Leave: up and out, ending exactly on the seam
      tl.to('.stage', {{ y: -120, opacity: 0, filter: 'blur(12px)', duration: 0.24, ease: 'power3.in' }}, {t - 0.24:.2f});"""


def cap_in(pid, t_head, t_sub):
    return f"""      tl.fromTo('#{pid}-k', {{ opacity: 0, x: -20 }}, {{ opacity: 1, x: 0, duration: 0.3, ease: 'power3.out' }}, {t_head - 0.1:.2f});
      tl.fromTo('#{pid}-h', {{ opacity: 0, y: 30, filter: 'blur(8px)' }}, {{ opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.34, ease: 'expo.out' }}, {t_head:.2f});
      tl.fromTo('#{pid}-s', {{ opacity: 0, y: 16 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }}, {t_sub:.2f});"""


def bubble_in(sel, t, origin='0% 100%'):
    return f"      tl.fromTo('{sel}', {{ opacity: 0, y: 24, scale: 0.97, transformOrigin: '{origin}' }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.36, ease: 'expo.out' }}, {t:.2f});"


def press(sel, t):
    return f"      tl.to('{sel}', {{ scale: 0.94, duration: 0.08, ease: 'power2.in', yoyo: true, repeat: 1 }}, {t - 0.08:.2f});"


def tap(sel, x, y, t):
    return f"""      tl.set('{sel}', {{ left: {x - 45}, top: {y - 45} }}, 0);
      tl.fromTo('{sel}', {{ opacity: 0.9, scale: 0.3 }}, {{ opacity: 0, scale: 1.5, duration: 0.45, ease: 'power2.out', immediateRender: false }}, {t:.2f});"""


# ---------------------------------------------------------------------------------------------
# 1 · Hook — 0.0–4.0
HOOK_CSS = """
    #h-stage { position: absolute; inset: 0; }
    #h-tools { position: absolute; left: 0; right: 0; top: 640px; display: flex; flex-direction: column; align-items: center; gap: 70px; }
    .h-tool { display: flex; flex-direction: row; align-items: center; gap: 56px; width: 700px; }
    /* flex: none — in the vertical row layout a long word ("NUMBER.") would otherwise squeeze the circle */
    .h-btn { flex: none; width: 210px; height: 210px; border-radius: 50%; border: 4px solid #2a3038; display: flex; align-items: center; justify-content: center;
      color: #7b8590; font-family: 'LTCG Mono', monospace; font-size: 88px; background: #0e1013; }
    .h-word { font-size: 104px; line-height: 1; letter-spacing: 0.02em; }
    #h-line { position: absolute; left: 0; right: 0; top: 300px; text-align: center; font-size: 92px; line-height: 1.04; }
    #h-line em { font-style: normal; color: #d6ff3f; }
    #h-k { position: absolute; left: 0; right: 0; top: 220px; text-align: center; font-size: 30px; color: #b9c2cc; }
"""
HOOK_BODY = f"""
    <div id="h-stage">
      <div id="h-k" class="mono">LebanonTCG · Messages</div>
      <div id="h-line" class="display">Set up the whole<br><em>deal</em> in chat.</div>
      <div id="h-tools">
        <div class="h-tool"><div class="h-btn" id="h-b1">$</div><div class="h-word display" id="h-w1">Offer.</div></div>
        <div class="h-tool"><div class="h-btn" id="h-b2">{ic(PHONE, 92)}</div><div class="h-word display" id="h-w2">Number.</div></div>
        <div class="h-tool"><div class="h-btn" id="h-b3">{ic(PIN, 96)}</div><div class="h-word display" id="h-w3">Meetup.</div></div>
      </div>
    </div>"""
HOOK_JS = """
      // The three tools rise in together, unlit
      // Frame 0 is the thumbnail: the three tools are already there, unlit, breathing in
      tl.fromTo('.h-btn', { scale: 0.96 }, { scale: 1, duration: 0.5, ease: 'sine.out' }, 0);
      tl.set('.h-word', { opacity: 0 }, 0);
      // beat-locked: 0.5 / 1.0 / 1.5 s — each tool lights as its word slams in
      [['#h-b1', '#h-w1', 0.5], ['#h-b2', '#h-w2', 1.0], ['#h-b3', '#h-w3', 1.5]].forEach(([b, w, t]) => {
        tl.to(b, { borderColor: '#d6ff3f', color: '#d6ff3f', boxShadow: '0 0 60px -6px rgba(214, 255, 63, 0.65)', duration: 0.12, ease: 'power2.out' }, t);
        tl.fromTo(b, { scale: 1.12 }, { scale: 1, duration: 0.35, ease: 'back.out(2)' }, t);
        tl.fromTo(w, { opacity: 0, scale: 1.35, filter: 'blur(10px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.22, ease: 'expo.out' }, t);
      });
      // beat-locked: 2.0 s — the line, held to the cut (2.0 s for 7 words)
      tl.fromTo('#h-k', { opacity: 0 }, { opacity: 1, duration: 0.3 }, 1.9);
      tl.fromTo('#h-line', { opacity: 0, y: 40, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.32, ease: 'expo.out' }, 2.0);
      // Leave toward the chat
      tl.to('#h-stage', { y: -120, opacity: 0, filter: 'blur(12px)', duration: 0.24, ease: 'power3.in' }, 3.76);
"""

# ---------------------------------------------------------------------------------------------
# 2 · Offer — 4.0–9.0
OFFER_CSS = """
    #o-m1 { top: 0; }
    #o-card { top: 176px; width: 470px; }
    #o-card .v { font-size: 76px; line-height: 1; margin-top: 12px; }
    #o-card .n { font-size: 26px; margin-top: 12px; color: #e6eaee; }
    #o-card .st { position: relative; height: 30px; margin-top: 14px; }
    #o-card .st span { position: absolute; left: 0; top: 0; font-size: 22px; white-space: nowrap; }
    #o-sent { color: #7b8590; }
    #o-ok { color: #d6ff3f; }
    #o-pill { top: 520px; }
    #o-bar .amt { width: 190px; }
    #o-bar .note { flex: 1; }
"""
OFFER_BODY = f"""
    <div class="stage">
      <div class="panel">{head()}
        <div class="log">
          <div class="bub theirs" id="o-m1">Still available! Price is a bit negotiable for a quick pickup.<div class="meta mono" data-layout-ignore>2:14 pm</div></div>
          <div class="card" id="o-card">
            <div class="k mono">Offer · Non-binding</div>
            <div class="v display">$290</div>
            <div class="n">Cash, this weekend?</div>
            <div class="st mono"><span id="o-sent">Sent</span><span id="o-ok">✓ Offer accepted</span></div>
          </div>
          <div class="pill" id="o-pill"><span class="mono">Offer accepted · $290</span></div>
        </div>
        <div class="bar" id="o-bar">
          <span class="barlab mono">Offer</span>
          <div class="field amt">$&nbsp;<span class="typed" id="o-amt">290</span><span class="caret" id="o-c1"></span></div>
          <div class="field note" data-layout-ignore><span class="typed" id="o-note" style="font-family: 'LTCG Sans', sans-serif;">Cash, this weekend?</span></div>
          <div class="btn acid mono" id="o-send">Send offer</div>
        </div>{composer('offer')}
      </div>
      <div class="tap" id="o-tap"></div>{caption('o', '01', 'Offer', 'Make an<br>offer.', 'They accept it with one tap.')}
    </div>"""
OFFER_JS = f"""
{ENTER}
      // 4.0 s (local 0) — the seller's reply is already there; it settles in with the stage
{bubble_in('#o-m1', 0.05)}
      // 4.5 s (local 0.5) — the $ tool opens the offer bar
      tl.fromTo('#o-bar', {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'expo.out' }}, 0.5);
{typing('#o-amt', '290', 0.75, 0.25)}
      tl.set('#o-note', {{ width: 'auto', opacity: 0 }}, 0);
      tl.fromTo('#o-note', {{ opacity: 0, x: -10 }}, {{ opacity: 1, x: 0, duration: 0.2 }}, 1.25);
      tl.fromTo('#o-c1', {{ opacity: 1 }}, {{ opacity: 0, duration: 0.01 }}, 1.25);
{cap_in('o', 0.5, 3.0)}
      // 5.5 s (local 1.5) — Send offer: the bar closes and the offer card lands
{press('#o-send', 1.5)}
      tl.to('#o-bar', {{ opacity: 0, y: 20, duration: 0.2, ease: 'power2.in' }}, 1.55);
      tl.fromTo('#o-card', {{ opacity: 0, scale: 1.08, filter: 'blur(6px)', transformOrigin: '100% 50%' }}, {{ opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.42, ease: 'expo.out' }}, 1.5);
      tl.set('#o-ok', {{ opacity: 0 }}, 0);
      // 7.0 s (local 3.0) — accepted: the state flips and the system pill appears
      tl.to('#o-sent', {{ opacity: 0, duration: 0.15 }}, 3.0);
      tl.fromTo('#o-ok', {{ opacity: 0, y: 8 }}, {{ opacity: 1, y: 0, duration: 0.25, ease: 'back.out(2)' }}, 3.0);
      tl.to('#o-card', {{ boxShadow: '0 0 50px -10px rgba(214, 255, 63, 0.7)', duration: 0.3 }}, 3.0);
      tl.fromTo('#o-pill', {{ opacity: 0, scale: 0.9 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.8)' }}, 3.25);
{exit_at(5.0)}
"""

# ---------------------------------------------------------------------------------------------
# 3 · Number — 9.0–13.0
PHONE_CSS = """
    #p-pill { top: 0; }
    #p-m1 { top: 70px; }
    #p-card { top: 250px; width: 560px; }
    #p-card .num { display: flex; align-items: center; gap: 18px; margin-top: 16px; font-size: 54px; line-height: 1; white-space: nowrap; }
    #p-card .flag { width: 52px; height: 39px; border-radius: 4px; box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.15); }
    .ccp { height: 64px; display: inline-flex; align-items: center; gap: 12px; padding: 0 18px; border-radius: 10px; border: 2px solid #2a3038; background: #0e1013; font-family: 'LTCG Mono', monospace; font-size: 28px; }
    .ccp img { width: 34px; height: 26px; border-radius: 3px; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15); }
    .ccp .caret-d { color: #7b8590; font-size: 14px; }
    #p-bar .num-in { flex: 1; }
"""
PHONE_BODY = f"""
    <div class="stage">
      <div class="panel">{head()}
        <div class="log">
          <div class="pill" id="p-pill"><span class="mono">Offer accepted · $290</span></div>
          <div class="bub theirs" id="p-m1">Deal! Share your number and pick a spot.<div class="meta mono" data-layout-ignore>2:16 pm</div></div>
          <div class="card" id="p-card">
            <div class="k mono">You shared your number</div>
            <div class="num display"><img class="flag" src="assets/img/flag-lb.svg" alt="" />+961 70 000 000</div>
            <div class="meta mono" data-layout-ignore>2:16 pm · Seen</div>
          </div>
        </div>
        <div class="bar" id="p-bar">
          <span class="barlab mono">Phone</span>
          <div class="ccp" id="p-ccp"><img src="assets/img/flag-lb.svg" alt="" />+961<span class="caret-d">▾</span></div>
          <div class="field num-in"><span class="typed" id="p-num">70 000 000</span><span class="caret" id="p-c"></span></div>
          <div class="btn acid mono" id="p-send">Share number</div>
          <div class="hint" data-layout-ignore>Only @mayapulls will see it, here in this chat. It isn&#39;t added to your profile.</div>
        </div>{composer('phone')}
      </div>{caption('p', '02', 'Number', 'Share your<br>number.', 'Only they see it. Never on your profile.')}
    </div>"""
PHONE_JS = f"""
{ENTER}
{bubble_in('#p-m1', 0.1)}
      tl.fromTo('#p-bar', {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'expo.out' }}, 0.2);
      // the flag picker settles on Lebanon
      tl.fromTo('#p-ccp', {{ borderColor: '#d6ff3f' }}, {{ borderColor: '#2a3038', duration: 0.5 }}, 0.5);
      // 9.5–10.75 s — the digits, a sixteenth apart
{typing('#p-num', '70 000 000', 0.5, 0.125)}
{cap_in('p', 0.5, 1.0)}
      // 11.0 s (local 2.0) — Share number: the bar closes and the card lands
{press('#p-send', 2.0)}
      tl.to('#p-bar', {{ opacity: 0, y: 20, duration: 0.2, ease: 'power2.in' }}, 2.05);
      tl.fromTo('#p-card', {{ opacity: 0, scale: 1.08, filter: 'blur(6px)', transformOrigin: '100% 50%' }}, {{ opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.42, ease: 'expo.out' }}, 2.0);
{exit_at(4.0)}
"""

# ---------------------------------------------------------------------------------------------
# 4 · Meetup — 13.0–18.0
MEET_CSS = """
    #m-m1 { top: 0; }
    #m-bar .loc { flex: 1; }
    #m-bar .btn.out { color: #e6eaee; }
    #m-share { opacity: 0.45; }
    /* the map picker, over the chat panel, with the app's overlay dimming what's under it */
    #m-scrim { position: absolute; inset: 0; background: rgba(8, 9, 11, 0.78); opacity: 0; }
    #m-pick { position: absolute; left: 100px; top: 760px; width: 880px; height: 900px; border-radius: 26px; overflow: hidden;
      background: #16191e; border: 2px solid #2a3038; box-shadow: 0 50px 120px -30px rgba(0, 0, 0, 0.95); }
    #m-pick .t { padding: 30px 34px 0; font-size: 40px; }
    #m-pick .d { padding: 10px 34px 0; font-size: 24px; color: #b9c2cc; }
    #m-view { position: absolute; left: 0; right: 0; top: 150px; height: 620px; overflow: hidden; background: #f2efe9; }
    /* the meeting point (900, 520) sits under the pin at x = y = 0 */
    #m-map { position: absolute; left: calc(50% - 900px); top: calc(50% - 520px); width: 1600px; height: 1200px; }
    .mpin { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -50px 0 0 -23px;
      border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: #d6ff3f; border: 4px solid #08090b; box-shadow: 0 10px 22px rgba(0, 0, 0, 0.45); }
    .mpin::after { content: ''; position: absolute; left: 50%; top: 50%; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; background: #08090b; }
    #m-pinwrap { position: absolute; inset: 0; }
    #m-foot { position: absolute; left: 0; right: 0; bottom: 0; height: 130px; display: flex; align-items: center; gap: 16px; padding: 0 34px; border-top: 2px solid rgba(255, 255, 255, 0.06); }
    #m-coords { margin-right: auto; font-size: 26px; color: #b9c2cc; white-space: nowrap; }
    /* the shared location card */
    #m-card { top: 120px; width: 600px; }
    #m-card .place { display: flex; align-items: center; gap: 14px; margin-top: 14px; font-size: 38px; line-height: 1.1; }
    #m-card .place svg { color: #d6ff3f; }
    #m-mini { position: relative; height: 210px; margin-top: 16px; border-radius: 14px; overflow: hidden; border: 2px solid #2a3038; background: #f2efe9; }
    #m-mini img { position: absolute; left: calc(50% - 900px); top: calc(50% - 520px); width: 1600px; height: 1200px; }
    #m-mini .mpin { width: 34px; height: 34px; margin: -37px 0 0 -17px; border-width: 3px; }
    #m-mini .mpin::after { width: 10px; height: 10px; margin: -5px 0 0 -5px; }
    #m-card .co { font-size: 24px; color: #b9c2cc; margin-top: 14px; }
    #m-card .acts { display: flex; gap: 14px; margin-top: 16px; }
"""
MEET_BODY = f"""
    <div class="stage">
      <div class="panel">{head()}
        <div class="log">
          <div class="bub theirs" id="m-m1">Got it. Where do we meet?<div class="meta mono" data-layout-ignore>2:17 pm</div></div>
          <div class="card" id="m-card">
            <div class="k mono">You shared a location</div>
            <div class="place display">{ic(PIN, 38)}Zaitunay Bay, Beirut</div>
            <div id="m-mini"><img src="assets/img/beirut-map.svg" alt="" /><span class="mpin"></span></div>
            <div class="co mono" data-layout-ignore>33.90153, 35.49870</div>
            <div class="acts"><span class="btn acid mono">Google Maps</span><span class="btn out mono">Waze</span></div>
          </div>
        </div>
        <div class="bar" id="m-bar">
          <span class="barlab mono">Location</span>
          <div class="btn out mono" id="m-me">{ic(PIN, 24)}Use my current location</div>
          <div class="btn out mono" id="m-onmap">{ic(MAP, 24)}Choose on the map</div>
          <div class="field ph loc">Place name (optional)</div>
          <div class="btn acid mono" id="m-share">Share location</div>
          <div class="hint" data-layout-ignore>Meet somewhere public, not at home. Only @mayapulls will see it.</div>
        </div>{composer('pin')}
      </div>
      <div class="tap" id="m-tap1"></div>
      <div id="m-scrim"></div>
      <div id="m-pick" data-layout-allow-overlap>
        <div class="t display">Choose a meeting place</div>
        <div class="d">Move the map until the pin sits on the spot. Somewhere public.</div>
        <div id="m-view">
          <img id="m-map" src="assets/img/beirut-map.svg" alt="" />
          <div id="m-pinwrap"><span class="mpin"></span></div>
        </div>
        <div id="m-foot">
          <span class="mono" id="m-coords" data-layout-ignore>33.90153, 35.49870</span>
          <span class="btn out mono">Cancel</span>
          <span class="btn acid mono" id="m-use">Use this spot</span>
        </div>
      </div>
      <div class="tap" id="m-tap2"></div>{caption('m', '03', 'Meetup', 'Pick a<br>public spot.', 'Opens in Google Maps or Waze.')}
    </div>"""
# Map pan: CSS centres the meeting point (900, 520) under the pin; the pan eases the map in
# from 300 px east and 180 px south of it.
MEET_JS = f"""
{ENTER}
{bubble_in('#m-m1', 0.05)}
      tl.fromTo('#m-bar', {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'expo.out' }}, 0.15);
{cap_in('m', 0.5, 2.5)}
      // 13.5 s (local 0.5) — tap "Choose on the map"
{tap('#m-tap1', 288, 1497, 0.5)}
{press('#m-onmap', 0.5)}
      tl.to('#m-onmap', {{ borderColor: '#d6ff3f', color: '#d6ff3f', duration: 0.1 }}, 0.5);
      // 14.0 s (local 1.0) — the picker rises; the map pans under the fixed pin until 15.0
      tl.fromTo('#m-scrim', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.3 }}, 1.0);
      tl.to('#m-scrim', {{ opacity: 0, duration: 0.22 }}, 2.78);
      tl.fromTo('#m-pick', {{ opacity: 0, y: 80, scale: 0.97 }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'expo.out' }}, 1.0);
      tl.fromTo('#m-map', {{ x: 300, y: 180 }}, {{ x: 0, y: 0, duration: 1.0, ease: 'power3.inOut' }}, 1.0);
      tl.fromTo('#m-pinwrap', {{ y: -14 }}, {{ y: -14, duration: 0.01 }}, 1.0);
      tl.to('#m-pinwrap', {{ y: 0, duration: 0.28, ease: 'bounce.out' }}, 2.0);
      // coordinates follow the pan (a pure function of time via a tweened proxy)
      (function () {{
        const el = document.querySelector('#m-coords');
        const p = {{ k: 0 }};
        const show = () => {{
          const lat = 33.89611 + (33.90153 - 33.89611) * p.k;
          const lng = 35.50391 + (35.49870 - 35.50391) * p.k;
          el.textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);
        }};
        tl.fromTo(p, {{ k: 0 }}, {{ k: 1, duration: 1.0, ease: 'power3.inOut', onUpdate: show, onStart: show }}, 1.0);
        tl.set(p, {{ k: 0, onComplete: show }}, 0);
      }})();
      // 15.5 s (local 2.5) — Use this spot
{tap('#m-tap2', 822, 1597, 2.5)}
{press('#m-use', 2.5)}
      // 16.0 s (local 3.0) — the picker and bar close, the location card lands
      tl.to('#m-pick', {{ opacity: 0, y: 60, duration: 0.22, ease: 'power2.in' }}, 2.78);
      tl.to('#m-bar', {{ opacity: 0, y: 20, duration: 0.2, ease: 'power2.in' }}, 2.8);
      tl.fromTo('#m-card', {{ opacity: 0, scale: 1.06, filter: 'blur(6px)', transformOrigin: '100% 0%' }}, {{ opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.42, ease: 'expo.out' }}, 3.0);
{exit_at(5.0)}
"""

# ---------------------------------------------------------------------------------------------
# 5 · Outro — 18.0–21.0
OUTRO_CSS = """
    #e-halo { position: absolute; left: 40px; right: 40px; top: 560px; height: 820px;
      background: radial-gradient(ellipse 50% 50% at 50% 50%, rgba(123, 92, 255, 0.32), rgba(123, 92, 255, 0) 70%),
        radial-gradient(ellipse 30% 30% at 62% 52%, rgba(214, 255, 63, 0.14), rgba(214, 255, 63, 0) 70%); }
    #e-recap { position: absolute; left: 0; right: 0; top: 380px; display: flex; justify-content: center; align-items: center; gap: 26px; font-size: 30px; color: #d6ff3f; }
    .e-tool { width: 74px; height: 74px; border-radius: 50%; border: 3px solid #d6ff3f; display: flex; align-items: center; justify-content: center; font-family: 'LTCG Mono', monospace; font-size: 30px; }
    .e-sep { color: #8b95a1; }
    #e-logo { position: absolute; left: 0; right: 0; top: 640px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 44px; }
    #e-flag { width: 220px; height: 220px; }
    #e-word { font-size: 128px; letter-spacing: 0.05em; line-height: 1; white-space: nowrap; }
    #e-word .dot { color: #d6ff3f; margin-left: 0.18em; }
    #e-tag { position: absolute; left: 0; right: 0; top: 1150px; text-align: center; font-size: 38px; line-height: 1.6; letter-spacing: 0.16em; color: #c9d0d7; }
    #e-url { position: absolute; left: 0; right: 0; top: 1330px; text-align: center; font-size: 46px; letter-spacing: 0.06em; color: #d6ff3f; text-transform: none; }
"""
OUTRO_BODY = f"""
    <div id="e-halo"></div>
    <div id="e-recap" class="mono">
      <span class="e-tool">$</span><span>Offer</span><span class="e-sep">·</span>
      <span class="e-tool">{ic(PHONE, 32)}</span><span>Number</span><span class="e-sep">·</span>
      <span class="e-tool">{ic(PIN, 34)}</span><span>Meetup</span>
    </div>
    <div id="e-logo">
      <img id="e-flag" src="assets/img/flag.png" alt="" />
      <div id="e-word" class="display">LebanonTCG<span class="dot">.</span></div>
    </div>
    <div id="e-tag" class="mono">We connect collectors.<br>You handle the deal.</div>
    <div id="e-url" class="mono">www.lebanontcg.com</div>"""
OUTRO_JS = """
      // 18.0 s (local 0) — the recap row: what you just saw, in the composer's own icons
      tl.fromTo('#e-recap > *', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.3, ease: 'expo.out', stagger: 0.04 }, 0);
      // 18.5 s (local 0.5) — the lockup lands with the bell
      tl.fromTo('#e-halo', { opacity: 0, scale: 0.9 }, { opacity: 0.85, scale: 1, duration: 0.6, ease: 'power2.out' }, 0.5);
      tl.fromTo('#e-flag', { opacity: 0, scale: 0.7, rotation: -8 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(1.4)' }, 0.5);
      tl.fromTo('#e-word', { opacity: 0, clipPath: 'inset(0% 100% 0% 0%)', filter: 'blur(6px)' }, { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', filter: 'blur(0px)', duration: 0.4, ease: 'power4.out' }, 0.52);
      // 18.85 s (local 0.85) — the footer line and the address, held over 2.0 s
      tl.fromTo('#e-tag', { opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.24, ease: 'power4.out' }, 0.85);
      tl.fromTo('#e-url', { opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.24, ease: 'power4.out' }, 0.9);
      tl.to('#e-halo', { opacity: 0.6, duration: 1.4, ease: 'sine.inOut' }, 1.4);
"""

SCENES = {
    'hook': (HOOK_CSS, HOOK_BODY, HOOK_JS),
    'offer': (CHAT + OFFER_CSS, OFFER_BODY, OFFER_JS),
    'phone': (CHAT + PHONE_CSS, PHONE_BODY, PHONE_JS),
    'meet': (CHAT + MEET_CSS, MEET_BODY, MEET_JS),
    'outro': (OUTRO_CSS, OUTRO_BODY, OUTRO_JS),
}

os.makedirs(OUT, exist_ok=True)
for cid, (css, body, js) in SCENES.items():
    with open(os.path.join(OUT, f'{cid}.html'), 'w') as f:
        f.write(scene(cid, css, body, js))
print('wrote', ', '.join(SCENES))
