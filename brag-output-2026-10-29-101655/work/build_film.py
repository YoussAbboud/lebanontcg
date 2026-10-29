"""Writes composition/index.html and composition/compositions/film.html.

"On your home screen": two deadpan hook lines, then the real phone — the home page, the install sheet
rising, its three step rows lifting out to stack with giant numerals, the Android button and its tap, the
icon flying onto a drawn home screen and opening into the full app view — and the lockup. One scene;
every cue is a beat at 112 BPM (B = 60/112 s), written as T(n); the soundtrack (work/synth.py) uses the
same beat numbers. Capture geometry comes from work/layout.json (CSS px at 390 wide; the phone is 800 wide).
"""
import json
import os

HERE = os.path.dirname(__file__)
COMP = os.path.join(HERE, 'composition')
BPM = 112
B = 60 / BPM
BEATS = 34
DUR = round(BEATS * B, 4)
LAY = json.load(open(os.path.join(HERE, 'layout.json')))


def T(n):
    return round(n * B, 4)


# ---- the phone: the 390-px page at 800 wide, in a rounded screen at the bottom of the frame ----
PH = {'x': 140, 'y': 400, 'w': 800, 'h': 1421, 'r': 50}
S = PH['w'] / LAY['vw']
L = lambda v: round(v * S, 2)
IOS = LAY['sheetIos']
AND = LAY['sheetAndroid']
STEPS = IOS['steps']
# the step cards' stack (frame coords) and scale
CS = 1.18
CARD_W = L(STEPS[0]['box']['w']) * CS
CARD_H = L(STEPS[0]['box']['h']) * CS
CARD_X = 168
CARD_Y = [744, 926, 1108]
# the Android button card
BTN = AND['install']
BTN_W = L(BTN['w']) * CS
BTN_H = L(BTN['h']) * CS
BTN_X = 168
BTN_Y = 980
# the home screen grid (phone-local)
TILE = 140
GX, GY, GAP, PITCH = 48, 180, 80, 222
SLOT = (1, 2)  # row, col
SLOT_X = GX + SLOT[1] * (TILE + GAP)
SLOT_Y = GY + SLOT[0] * PITCH
# the sheet's tile (frame coords, the icon's start)
TILE0 = {'x': PH['x'] + L(IOS['tile']['x']), 'y': PH['y'] + L(IOS['tile']['y']), 's': L(IOS['tile']['w'])}


def card_bg(variant, box):
    """A rectangle of a sheet capture, as its own element (background-position crop)."""
    sheet = IOS['box'] if variant == 'ios' else AND['box']
    return (f"background-image: url('assets/img/sheet-{variant}-4x.png'); "
            f"background-size: {L(sheet['w']) * CS:.2f}px {L(sheet['h']) * CS:.2f}px; "
            f"background-position: {-L(box['x'] - sheet['x']) * CS:.2f}px {-L(box['y'] - sheet['y']) * CS:.2f}px;")


def tiles():
    out = []
    for i in range(16):
        r, c = divmod(i, 4)
        if (r, c) == SLOT:
            continue
        hue = (i * 47) % 360
        x, y = GX + c * (TILE + GAP), GY + r * PITCH
        out.append(f'<div class="tile" style="left:{x}px;top:{y}px;background:linear-gradient(160deg, hsl({hue} 10% 20%), hsl({hue} 8% 13%))">'
                   f'<i style="background:hsl({hue} 12% 30%)"></i><b></b></div>')
    for i in range(4):
        hue = (i * 83 + 20) % 360
        out.append(f'<div class="tile dock" style="left:{40 + 40 + i * (TILE + 40)}px;top:{PH["h"] - 200 + 18}px;background:linear-gradient(160deg, hsl({hue} 10% 22%), hsl({hue} 8% 14%))"></div>')
    return '\n'.join(out)


CSS = f"""
    @font-face {{ font-family: 'Chakra Petch'; font-weight: 700; src: url('assets/fonts/chakra-petch-latin-700-normal.woff2') format('woff2'); }}
    @font-face {{ font-family: 'LTCG Sans'; font-weight: 400; src: url('assets/fonts/inter-latin-400-normal.woff2') format('woff2'); }}
    @font-face {{ font-family: 'LTCG Sans'; font-weight: 500; src: url('assets/fonts/inter-latin-500-normal.woff2') format('woff2'); }}
    @font-face {{ font-family: 'LTCG Sans'; font-weight: 600; src: url('assets/fonts/inter-latin-600-normal.woff2') format('woff2'); }}
    @font-face {{ font-family: 'LTCG Mono'; font-weight: 500; src: url('assets/fonts/jetbrains-mono-latin-500-normal.woff2') format('woff2'); }}
    @font-face {{ font-family: 'LTCG Mono'; font-weight: 700; src: url('assets/fonts/jetbrains-mono-latin-700-normal.woff2') format('woff2'); }}
    #root {{ position: absolute; inset: 0; overflow: hidden; background: #08090b; font-family: 'LTCG Sans', sans-serif; color: #f2f5f7; }}
    .mono {{ font-family: 'LTCG Mono', monospace; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; }}
    .display {{ font-family: 'Chakra Petch', sans-serif; font-weight: 700; text-transform: uppercase; }}

    /* ---- the hook lines ----------------------------------------------------------------------- */
    .hook {{ position: absolute; left: 40px; width: 1000px; text-align: center; font-size: 112px; line-height: 1; letter-spacing: -0.01em; opacity: 0; }}
    #n1 {{ top: 760px; }}
    #n2 {{ top: 900px; color: #d6ff3f; }}

    /* ---- captions, top band -------------------------------------------------------------------- */
    .cap {{ position: absolute; left: 90px; width: 900px; top: 190px; text-align: center; opacity: 0; }}
    .cap .h {{ font-size: 64px; line-height: 1.06; letter-spacing: -0.01em; text-shadow: 0 2px 18px rgba(0,0,0,0.35); }}
    .cap .s {{ margin-top: 14px; font-size: 34px; line-height: 1.3; font-weight: 500; color: #d6ff3f; }}

    /* ---- the phone ----------------------------------------------------------------------------- */
    #phone {{ position: absolute; left: {PH['x']}px; top: {PH['y']}px; width: {PH['w']}px; height: {PH['h']}px; border-radius: {PH['r']}px; overflow: hidden; background: #08090b;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 40px 90px -30px rgba(0,0,0,0.7), 0 12px 30px rgba(0,0,0,0.35); }}
    #page {{ position: absolute; left: 0; top: 0; width: {PH['w']}px; height: {PH['h']}px; }}
    #dim {{ position: absolute; inset: 0; background: rgba(8,9,11,0.78); opacity: 0; }}
    #sheet {{ position: absolute; left: 0; top: {L(IOS['box']['y'])}px; width: {L(IOS['box']['w'])}px; height: {L(IOS['box']['h'])}px; border-radius: {L(20)}px {L(20)}px 0 0; overflow: hidden; }}
    #sheet img {{ display: block; width: 100%; height: 100%; }}
    #tilehole {{ position: absolute; left: {L(IOS['tile']['x'])}px; top: {L(IOS['tile']['y'] - IOS['box']['y'])}px; width: {L(IOS['tile']['w'])}px; height: {L(IOS['tile']['h'])}px; border-radius: {L(15)}px; background: #16191e; opacity: 0; }}
    #home {{ position: absolute; inset: 0; opacity: 0; background: radial-gradient(58% 42% at 50% 62%, rgba(214,255,63,0.10), rgba(214,255,63,0) 70%), linear-gradient(180deg, #0c0e12 0%, #08090b 60%, #0a0b0f 100%); }}
    #home .bar {{ position: absolute; left: 54px; right: 54px; top: 34px; height: 44px; display: flex; align-items: center; justify-content: space-between; font-weight: 600; font-size: 32px; }}
    #home .bar .r {{ display: flex; align-items: center; gap: 12px; }}
    #home .bar .sig {{ display: flex; align-items: flex-end; gap: 3px; }}
    #home .bar .sig span {{ width: 6px; border-radius: 2px; background: #f2f5f7; }}
    #home .bar .bat {{ width: 54px; height: 26px; border-radius: 8px; border: 2.5px solid rgba(242,245,247,0.6); position: relative; }}
    #home .bar .bat span {{ position: absolute; left: 3px; top: 3px; bottom: 3px; width: 28px; border-radius: 4px; background: #f2f5f7; }}
    #home .tile {{ position: absolute; width: {TILE}px; height: {TILE}px; border-radius: 32px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 18px -8px rgba(0,0,0,0.6); }}
    #home .tile i {{ position: absolute; left: 36px; right: 36px; top: 60px; height: 20px; border-radius: 10px; opacity: 0.55; }}
    #home .tile b {{ position: absolute; left: {TILE // 2 - 40}px; top: {TILE + 14}px; width: 80px; height: 14px; border-radius: 7px; background: rgba(242,245,247,0.22); }}
    #home .dockbg {{ position: absolute; left: 40px; right: 40px; top: {PH['h'] - 200}px; height: 176px; border-radius: 44px; background: rgba(255,255,255,0.07); }}
    #lbl {{ position: absolute; left: {SLOT_X - 60}px; width: {TILE + 120}px; top: {SLOT_Y + TILE + 10}px; text-align: center; font-weight: 500; font-size: 32px; opacity: 0; }}
    #win {{ position: absolute; inset: 0; opacity: 0; clip-path: inset({SLOT_Y}px {PH['w'] - SLOT_X - TILE}px {PH['h'] - SLOT_Y - TILE}px {SLOT_X}px round 32px); }}
    #win img {{ position: absolute; left: 0; top: 0; width: {PH['w']}px; height: {PH['h']}px; transform-origin: 50% 50%; }}
    #phonedim {{ position: absolute; left: {PH['x']}px; top: {PH['y']}px; width: {PH['w']}px; height: {PH['h']}px; border-radius: {PH['r']}px; background: rgba(8,9,11,0.6); opacity: 0; }}

    /* ---- the step cards and their numerals (frame coords, over the phone) ---------------------- */
    .card {{ position: absolute; left: {CARD_X}px; width: {CARD_W:.2f}px; height: {CARD_H:.2f}px; border-radius: {L(12) * CS:.1f}px; opacity: 0; transform-origin: 0 0;
      box-shadow: 0 0 0 2px #d6ff3f, 0 30px 60px -20px rgba(0,0,0,0.8); }}
    .num {{ position: absolute; left: 44px; width: 110px; text-align: center; font-size: 140px; line-height: 1; color: #d6ff3f; opacity: 0; }}
    #btn {{ position: absolute; left: {BTN_X}px; top: {BTN_Y}px; width: {BTN_W:.2f}px; height: {BTN_H:.2f}px; border-radius: 999px; opacity: 0; {card_bg('android', BTN)} box-shadow: 0 30px 60px -20px rgba(0,0,0,0.8); }}
    .ring {{ position: absolute; width: 60px; height: 60px; margin: -30px 0 0 -30px; border-radius: 50%; border: 5px solid #d6ff3f; box-shadow: 0 0 0 2px rgba(8,9,11,0.7), inset 0 0 0 2px rgba(8,9,11,0.7); opacity: 0; }}
    #ring1 {{ left: {BTN_X + BTN_W / 2:.1f}px; top: {BTN_Y + BTN_H / 2:.1f}px; border-color: #08090b; box-shadow: 0 0 0 2px rgba(214,255,63,0.9), inset 0 0 0 2px rgba(214,255,63,0.9); }}
    #ring2 {{ left: {PH['x'] + SLOT_X + TILE / 2}px; top: {PH['y'] + SLOT_Y + TILE / 2}px; }}

    /* ---- the icon in flight (frame coords) ---------------------------------------------------- */
    #fly {{ position: absolute; left: 0; top: 0; width: {TILE}px; height: {TILE}px; opacity: 0; }}
    #icon {{ position: absolute; left: 0; top: 0; width: {TILE}px; height: {TILE}px; border-radius: 32px; box-shadow: 0 30px 60px -20px rgba(0,0,0,0.8); }}

    /* ---- the outro ----------------------------------------------------------------------------- */
    #out {{ position: absolute; inset: 0; background: #08090b; opacity: 0; z-index: 25; }}
    #lock {{ position: absolute; left: 0; right: 0; top: 700px; display: flex; flex-direction: column; align-items: center; gap: 34px; opacity: 0; }}
    #lock img {{ width: 170px; height: 170px; }}
    #lock .w {{ font-size: 112px; line-height: 1; letter-spacing: 0.04em; }}
    #lock .w b {{ color: #d6ff3f; font-weight: 700; }}
    #tag {{ position: absolute; left: 60px; right: 60px; top: 1130px; text-align: center; font-size: 34px; line-height: 1.6; letter-spacing: 0.18em; color: #d6ff3f; opacity: 0; }}
    #url {{ position: absolute; left: 0; right: 0; top: 1230px; text-align: center; font-size: 44px; letter-spacing: 0.02em; text-transform: none; color: #f2f5f7; opacity: 0; font-weight: 700; }}
"""

BODY = f"""
    <div class="hook display" id="n1">No app store.</div>
    <div class="hook display" id="n2">No download.</div>

    <div id="phone">
      <img id="page" src="assets/img/home-3x.png" alt="" />
      <div id="dim"></div>
      <div id="sheet"><img src="assets/img/sheet-ios-4x.png" alt="" /><div id="tilehole"></div></div>
      <div id="home">
        <div class="bar"><span>9:41</span><span class="r"><span class="sig"><span style="height:10px"></span><span style="height:15px"></span><span style="height:20px"></span><span style="height:25px"></span></span><span class="bat"><span></span></span></span></div>
        <div class="dockbg"></div>
        {tiles()}
        <div id="lbl">LebanonTCG</div>
      </div>
      <div id="win"><img id="winpage" src="assets/img/home-3x.png" alt="" /></div>
    </div>
    <div id="phonedim"></div>

    <div class="cap" id="k1"><div class="display h">A sheet shows you how.</div><div class="s">Two seconds after the page loads.</div></div>
    <div class="cap" id="k2"><div class="display h">Three taps on iPhone.</div></div>
    <div class="cap" id="k3"><div class="display h">Android? One.</div></div>
    <div class="cap" id="k4"><div class="display h">It's on your home screen.</div></div>
    <div class="cap" id="k5"><div class="display h">Opens full screen.</div><div class="s">Like an app. No browser bar.</div></div>

    {''.join(f'<div class="card" id="c{i + 1}" style="top:{CARD_Y[i]}px; {card_bg("ios", STEPS[i]["box"])}"></div>' for i in range(3))}
    {''.join(f'<div class="num display" id="d{i + 1}" style="top:{CARD_Y[i] + 4}px">{i + 1}</div>' for i in range(3))}
    <div id="btn"></div>
    <div class="ring" id="ring1"></div>
    <div class="ring" id="ring2"></div>
    <div id="fly"><img id="icon" src="assets/img/icon.png" alt="" /></div>

    <div id="out">
      <div id="lock"><img src="assets/img/flag.png" alt="" /><div class="w display">LebanonTCG<b>.</b></div></div>
      <div id="tag" class="mono">Add it to your home screen</div>
      <div id="url" class="mono">www.lebanontcg.com</div>
    </div>
"""


def js():
    L_ = []
    a = L_.append

    def cap_in(sel, n):
        a(f"      tl.fromTo('{sel}', {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }}, {T(n)});")

    def cap_out(sel, n):
        a(f"      tl.to('{sel}', {{ opacity: 0, y: -20, duration: 0.22, ease: 'power2.in' }}, {T(n) - 0.22:.4f});")

    def ring(sel, n):
        a(f"      tl.fromTo('{sel}', {{ opacity: 1, scale: 0.6 }}, {{ opacity: 0, scale: 2.6, duration: 0.5, ease: 'power2.out', immediateRender: false }}, {T(n)});")

    # ---- 1 · the hook (0–4): two slams, then the phone rises --------------------------------------
    a(f"      tl.fromTo('#n1', {{ opacity: 0, scale: 1.5 }}, {{ opacity: 1, scale: 1, duration: 0.22, ease: 'power4.out' }}, {T(1)});")
    a(f"      tl.fromTo('#n2', {{ opacity: 0, scale: 1.5 }}, {{ opacity: 1, scale: 1, duration: 0.22, ease: 'power4.out' }}, {T(2)});")
    a(f"      tl.to(['#n1', '#n2'], {{ opacity: 0, y: -420, duration: 0.32, ease: 'power3.in', stagger: 0.04 }}, {T(3.5)});")
    a(f"      tl.fromTo('#phone', {{ y: 1700 }}, {{ y: 0, duration: {T(1.2)}, ease: 'power3.out' }}, {T(4) - T(1.2):.4f});")
    a(f"      tl.fromTo('#phone', {{ scale: 1.02 }}, {{ scale: 1, duration: 0.4, ease: 'power2.out', immediateRender: false }}, {T(4)});")

    # ---- 2 · the sheet (4–8): the product's own motion --------------------------------------------
    a(f"      tl.to('#dim', {{ opacity: 1, duration: 0.3 }}, {T(5.4)});")
    a(f"      tl.fromTo('#sheet', {{ y: {L(IOS['box']['h'])} }}, {{ y: 0, duration: 0.42, ease: 'power3.out' }}, {T(6) - 0.42:.4f});")
    cap_in('#k1', 6)
    a(f"      tl.fromTo('#k1 .s', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.3 }}, {T(6.5)});")

    # ---- 3 · three taps (8–14): the step rows lift out and stack, one per beat ---------------------
    cap_out('#k1', 8)
    cap_in('#k2', 8)
    a(f"      tl.to('#phonedim', {{ opacity: 1, duration: 0.3 }}, {T(8.5)});")
    for i, n in enumerate((9, 10, 11)):
        box = STEPS[i]['box']
        sx, sy = PH['x'] + L(box['x']), PH['y'] + L(box['y'])
        a(f"      tl.fromTo('#c{i + 1}', {{ opacity: 1, x: {sx - CARD_X:.1f}, y: {sy - CARD_Y[i]:.1f}, scale: {1 / CS:.4f} }}, {{ opacity: 1, x: 0, y: 0, scale: 1, duration: 0.42, ease: 'back.out(1.4)', immediateRender: false }}, {T(n)});")
        a(f"      tl.fromTo('#d{i + 1}', {{ opacity: 0, x: -60 }}, {{ opacity: 1, x: 0, duration: 0.3, ease: 'power3.out' }}, {T(n) + 0.1:.4f});")

    # ---- 4 · Android (14–17): the cards drop, the button slides in, the tap ------------------------
    a(f"      tl.to(['#c1', '#c2', '#c3', '#d1', '#d2', '#d3'], {{ y: 1300, opacity: 0, duration: 0.35, ease: 'power3.in', stagger: 0.03 }}, {T(14)});")
    cap_out('#k2', 14)
    cap_in('#k3', 14)
    a(f"      tl.fromTo('#btn', {{ opacity: 1, y: 900 }}, {{ opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', immediateRender: false }}, {T(14.5)});")
    a(f"      tl.to('#btn', {{ scale: 0.96, duration: 0.08, ease: 'power2.out' }}, {T(15.5)});")
    a(f"      tl.to('#btn', {{ scale: 1, duration: 0.25, ease: 'back.out(2)' }}, {T(15.5) + 0.08:.4f});")
    ring('#ring1', 15.5)

    # ---- 5 · home screen (17–23): the icon flies, lands, is tapped, opens ---------------------------
    a(f"      tl.to('#btn', {{ opacity: 0, y: 200, duration: 0.3, ease: 'power2.in' }}, {T(17) - 0.1:.4f});")
    cap_out('#k3', 17)
    a(f"      tl.to('#phonedim', {{ opacity: 0, duration: 0.3 }}, {T(17)});")
    a(f"      tl.to('#home', {{ opacity: 1, duration: 0.4 }}, {T(17)});")
    a(f"      tl.to('#tilehole', {{ opacity: 1, duration: 0.15 }}, {T(17)});")
    a(f"      tl.set('#fly', {{ opacity: 1 }}, {T(17)});")
    a(f"      tl.fromTo('#fly', {{ x: {TILE0['x']:.1f}, y: {TILE0['y']:.1f} }}, {{ x: {PH['x'] + SLOT_X}, y: {PH['y'] + SLOT_Y}, duration: {T(2)}, ease: 'power2.inOut' }}, {T(17)});")
    a(f"      tl.fromTo('#icon', {{ scale: {TILE0['s'] / TILE:.4f}, y: 0 }}, {{ y: -170, scale: 1.15, duration: {T(1)}, ease: 'sine.out' }}, {T(17)});")
    a(f"      tl.to('#icon', {{ y: 0, scale: 1, duration: {T(1)}, ease: 'sine.in' }}, {T(18)});")
    a(f"      tl.to('#icon', {{ scale: 1.1, duration: 0.08, ease: 'power2.out' }}, {T(19)});")
    a(f"      tl.to('#icon', {{ scale: 1, duration: 0.3, ease: 'back.out(3)' }}, {T(19) + 0.08:.4f});")
    a(f"      tl.to('#lbl', {{ opacity: 1, duration: 0.25 }}, {T(19.3)});")
    cap_in('#k4', 19.5)
    a(f"      tl.to('#icon', {{ scale: 0.92, duration: 0.1 }}, {T(21)});")
    a(f"      tl.to('#icon', {{ scale: 1, duration: 0.2, ease: 'back.out(2)' }}, {T(21) + 0.1:.4f});")
    ring('#ring2', 21)
    a(f"      tl.set('#win', {{ opacity: 1 }}, {T(21.2)});")
    a(f"      tl.fromTo('#winpage', {{ scale: 0.66 }}, {{ scale: 1, duration: {T(1.8)}, ease: 'power3.inOut' }}, {T(21.2)});")
    a(f"      tl.to('#win', {{ clipPath: 'inset(0px 0px 0px 0px round 0px)', duration: {T(1.8)}, ease: 'power3.inOut' }}, {T(21.2)});")
    a(f"      tl.to('#fly', {{ opacity: 0, duration: 0.25 }}, {T(21.2) + 0.12:.4f});")
    cap_out('#k4', 23)

    # ---- 6 · full screen (23–27) -------------------------------------------------------------------
    cap_in('#k5', 23.5)
    a(f"      tl.fromTo('#k5 .s', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.3 }}, {T(24.5)});")

    # ---- 7 · outro (27–34) -------------------------------------------------------------------------
    a(f"      tl.to('#out', {{ opacity: 1, duration: 0.12 }}, {T(27) - 0.12:.4f});")
    a(f"      tl.set(['#phone', '#phonedim', '#k5'], {{ opacity: 0 }}, {T(27)});")
    a(f"      tl.fromTo('#lock', {{ opacity: 0, scale: 0.9 }}, {{ opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.4)' }}, {T(28)});")
    a(f"      tl.fromTo('#tag', {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }}, {T(29)});")
    a(f"      tl.fromTo('#url', {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }}, {T(29.75)});")
    return '\n'.join(L_)


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
    <title>LebanonTCG on your home screen</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #08090b; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #08090b; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1920">
      <!-- One continuous scene: the phone stays, everything happens on or around it. -->
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
