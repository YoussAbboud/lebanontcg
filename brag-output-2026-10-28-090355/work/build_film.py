"""Writes composition/index.html and composition/compositions/film.html.

"Two phones, one deal": one continuous scene, because the split screen persists from the
opening lime card to the closing one. Every cue is a beat at 112 BPM (B = 60/112 s), written
as T(n) below; the soundtrack (work/synth.py) uses the same beat numbers.
"""
import os

HERE = os.path.dirname(__file__)
COMP = os.path.join(HERE, 'composition')
BPM = 112
B = 60 / BPM
BEATS = 46
DUR = round(BEATS * B, 4)


def T(n):
    return round(n * B, 4)


PHONE = '<svg class="ic" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>'
PIN = '<svg class="ic" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'
MAP = '<svg class="ic" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>'


def ic(tpl, s):
    return tpl.format(s=s)


CSS = """
    @font-face { font-family: 'Chakra Petch'; font-weight: 700; src: url('assets/fonts/chakra-petch-latin-700-normal.woff2') format('woff2'); }
    @font-face { font-family: 'LTCG Sans'; font-weight: 400; src: url('assets/fonts/inter-latin-400-normal.woff2') format('woff2'); }
    @font-face { font-family: 'LTCG Sans'; font-weight: 600; src: url('assets/fonts/inter-latin-600-normal.woff2') format('woff2'); }
    @font-face { font-family: 'LTCG Mono'; font-weight: 500; src: url('assets/fonts/jetbrains-mono-latin-500-normal.woff2') format('woff2'); }
    #root { position: absolute; inset: 0; overflow: hidden; background: #08090b; font-family: 'LTCG Sans', sans-serif; color: #f2f5f7; }
    .mono { font-family: 'LTCG Mono', monospace; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; }
    .display { font-family: 'Chakra Petch', sans-serif; font-weight: 700; text-transform: uppercase; }
    svg.ic { display: block; flex: none; }

    /* ---- the two phones -------------------------------------------------------------------- */
    /* hidden until the lime card opens (nothing under the card is drawn) */
    .half { position: absolute; left: 0; width: 1080px; height: 900px; overflow: hidden; background: #0e1013; opacity: 0; }
    #top { top: 0; }
    #bot { top: 1020px; }
    .role { position: absolute; left: 60px; font-size: 26px; color: #b9c2cc; display: flex; align-items: center; gap: 14px; }
    .role b { width: 14px; height: 14px; border-radius: 50%; background: #d6ff3f; }
    #top .role { top: 150px; }
    #bot .role { top: 726px; }
    .head { position: absolute; left: 0; right: 0; height: 104px; display: flex; align-items: center; gap: 22px; padding: 0 60px; border-bottom: 2px solid rgba(255, 255, 255, 0.06); }
    #top .head { top: 196px; }
    #bot .head { top: 24px; }
    .thumb { width: 60px; height: 80px; border-radius: 10px; position: relative; flex: none;
      background: radial-gradient(circle at 35% 22%, #ff9d4d, #9b3a12 80%); border: 2px solid rgba(255, 157, 77, 0.6); }
    .thumb i { position: absolute; left: 17px; top: 27px; width: 26px; height: 26px; transform: rotate(45deg); border: 6px solid #ffb35c; background: #5a210a; }
    .who { font-size: 32px; font-weight: 600; display: flex; align-items: center; gap: 12px; }
    .dot { width: 13px; height: 13px; border-radius: 50%; background: #34d399; box-shadow: 0 0 10px rgba(52, 211, 153, 0.7); }
    .sub { font-size: 22px; color: #b9c2cc; margin-top: 6px; }
    .log { position: absolute; left: 60px; right: 60px; height: 450px; overflow: hidden; }
    #top .log { top: 320px; }
    #bot .log { top: 144px; }
    .grp { position: absolute; inset: 0; }
    .bub { position: absolute; border-radius: 24px; padding: 18px 24px 14px; font-size: 30px; line-height: 1.33; max-width: 700px; }
    .theirs { left: 0; background: #16191e; border: 2px solid rgba(255, 255, 255, 0.08); }
    .mine { right: 0; background: #d6ff3f; color: #08090b; }
    .meta { font-size: 18px; margin-top: 8px; color: #7b8590; }
    .mine .meta { color: #4b5512; }
    .card { position: absolute; border-radius: 24px; padding: 22px 26px 18px; background: #16191e; border: 2px solid #d6ff3f; }
    .card.mine { background: #16191e; color: #f2f5f7; }
    .card .k { font-size: 24px; color: #d6ff3f; }
    .card .v { font-size: 66px; line-height: 1; margin-top: 10px; }
    .card .n { font-size: 26px; margin-top: 10px; color: #e6eaee; }
    .acts { display: flex; gap: 14px; margin-top: 16px; }
    .btn { height: 60px; border-radius: 999px; display: inline-flex; align-items: center; gap: 12px; padding: 0 26px; font-size: 22px; white-space: nowrap; }
    .btn.acid { background: #d6ff3f; color: #08090b; }
    .btn.out { border: 2px solid #2a3038; color: #e6eaee; }
    .btn.no { border: 2px solid rgba(255, 92, 138, 0.55); color: #ff5c8a; }
    .pill { position: absolute; left: 0; right: 0; text-align: center; }
    .pill span { display: inline-block; font-size: 24px; color: #b9c2cc; padding: 10px 20px; border-radius: 999px; border: 2px solid rgba(255, 255, 255, 0.1); background: #121418; }
    .status { position: relative; height: 30px; margin-top: 12px; }
    .status span { position: absolute; left: 0; top: 0; font-size: 22px; white-space: nowrap; }
    .composer { position: absolute; left: 60px; right: 60px; height: 80px; display: flex; gap: 14px; align-items: center; }
    #top .composer { top: 796px; }
    #bot .composer { top: 620px; }
    .tool { width: 80px; height: 80px; border-radius: 50%; border: 2px solid #2a3038; display: flex; align-items: center; justify-content: center; color: #b9c2cc; font-family: 'LTCG Mono', monospace; font-size: 30px; flex: none; }
    .input { flex: 1; height: 80px; border-radius: 999px; border: 2px solid #2a3038; background: #16191e; color: #7b8590; font-size: 28px; display: flex; align-items: center; padding: 0 30px; }
    .send { height: 80px; padding: 0 32px; border-radius: 999px; background: #8aa324; color: #08090b; display: flex; align-items: center; font-size: 22px; }
    .bar { position: absolute; left: 60px; right: 60px; border: 2px solid #d6ff3f; border-radius: 20px; background: #16191e; padding: 18px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; opacity: 0; }
    .barlab { font-size: 24px; color: #d6ff3f; }
    .field { height: 64px; border-radius: 10px; border: 2px solid #2a3038; background: #0e1013; display: flex; align-items: center; padding: 0 18px; font-size: 28px; color: #f2f5f7; white-space: nowrap; overflow: hidden; }
    .typed { display: inline-block; overflow: hidden; white-space: nowrap; vertical-align: bottom; font-family: 'LTCG Mono', monospace; }
    .ccp { height: 64px; display: inline-flex; align-items: center; gap: 12px; padding: 0 16px; border-radius: 10px; border: 2px solid #2a3038; background: #0e1013; font-family: 'LTCG Mono', monospace; font-size: 28px; }
    .ccp img { width: 34px; height: 26px; border-radius: 3px; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15); }
    .num { display: flex; align-items: center; gap: 16px; margin-top: 12px; font-size: 52px; line-height: 1; white-space: nowrap; }
    .num img { width: 50px; height: 37px; border-radius: 4px; box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.15); }
    .place { display: flex; align-items: center; gap: 12px; margin-top: 12px; font-size: 34px; line-height: 1.1; }
    .place svg { color: #d6ff3f; }
    .mini { position: relative; height: 176px; margin-top: 14px; border-radius: 14px; overflow: hidden; border: 2px solid #2a3038; background: #f2efe9; }
    .mini img { position: absolute; left: calc(50% - 900px); top: calc(50% - 520px); width: 1600px; height: 1200px; }
    .mpin { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; margin: -48px 0 0 -22px;
      border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: #d6ff3f; border: 4px solid #08090b; box-shadow: 0 10px 22px rgba(0, 0, 0, 0.45); }
    .mpin::after { content: ''; position: absolute; left: 50%; top: 50%; width: 13px; height: 13px; margin: -6.5px 0 0 -6.5px; border-radius: 50%; background: #08090b; }
    .mini .mpin { width: 32px; height: 32px; margin: -35px 0 0 -16px; border-width: 3px; }
    .mini .mpin::after { width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; }
    .co { font-size: 22px; color: #b9c2cc; margin-top: 12px; }

    /* the map picker, filling the buyer's phone below its header */
    #map { position: absolute; left: 0; right: 0; top: 300px; bottom: 0; background: #16191e; opacity: 0; }
    #map .t { position: absolute; left: 60px; top: 18px; font-size: 32px; }
    #view { position: absolute; left: 0; right: 0; top: 76px; bottom: 0; overflow: hidden; background: #f2efe9; }
    #mapimg { position: absolute; left: calc(50% - 900px); top: calc(50% - 520px); width: 1600px; height: 1200px; }
    #pinwrap { position: absolute; inset: 0; }
    #mcoords { position: absolute; left: 24px; bottom: 24px; font-size: 22px; color: #f2f5f7; background: rgba(8, 9, 11, 0.82); padding: 14px 18px; border-radius: 12px; }
    #muse { position: absolute; right: 24px; bottom: 22px; height: 64px; }

    /* ---- the seam between the phones ------------------------------------------------------- */
    #seam { position: absolute; left: 0; top: 900px; width: 1080px; height: 120px; background: #d6ff3f; color: #08090b; overflow: hidden; opacity: 0; }
    .sl { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 18px; font-size: 54px; letter-spacing: 0.02em; opacity: 0; white-space: nowrap; }

    /* ---- the fingertip --------------------------------------------------------------------- */
    #finger { position: absolute; left: 0; top: 0; width: 76px; height: 76px; margin: -38px 0 0 -38px; border-radius: 50%;
      background: rgba(255, 255, 255, 0.82); border: 3px solid rgba(8, 9, 11, 0.35); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); opacity: 0; z-index: 30; }
    .ring { position: absolute; left: 0; top: 0; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; border: 5px solid #d6ff3f; opacity: 0; z-index: 29; }

    /* ---- the lime bookends ----------------------------------------------------------------- */
    .cov { position: absolute; left: 0; width: 1080px; height: 960px; overflow: hidden; background: #d6ff3f; z-index: 20; }
    #covT { top: 0; }
    #covB { top: 960px; }
    .covtext { position: absolute; left: 0; width: 1080px; height: 1920px; color: #08090b; }
    #covB .covtext { top: -960px; }
    .cw { position: absolute; left: 0; right: 0; text-align: center; font-size: 96px; line-height: 1.1; }
    .w1 { top: 720px; } .w2 { top: 905px; } .w3 { top: 1090px; }
    .ck { position: absolute; left: 0; right: 0; top: 600px; text-align: center; font-size: 30px; color: #2b3307; }

    #out { position: absolute; inset: 0; z-index: 25; color: #08090b; pointer-events: none; }
    #see { position: absolute; left: 0; right: 0; top: 700px; text-align: center; opacity: 0; }
    #see .a { font-size: 44px; color: #2b3307; }
    #see .b { font-size: 112px; line-height: 1.02; margin-top: 18px; }
    #see svg { margin: 0 auto 26px; color: #08090b; }
    #lock { position: absolute; left: 0; right: 0; top: 560px; display: flex; flex-direction: column; align-items: center; gap: 40px; opacity: 0; }
    #lock img { width: 210px; height: 210px; }
    #lock .w { font-size: 124px; line-height: 1; letter-spacing: 0.04em; }
    #tag { position: absolute; left: 0; right: 0; top: 1150px; text-align: center; font-size: 38px; line-height: 1.6; letter-spacing: 0.14em; color: #2b3307; opacity: 0; }
    #url { position: absolute; left: 0; right: 0; top: 1330px; text-align: center; font-size: 48px; letter-spacing: 0.05em; text-transform: none; color: #08090b; opacity: 0; }
"""


def head(handle):
    return f"""
        <div class="head">
          <div class="thumb"><i></i></div>
          <div>
            <div class="who">{handle} <span class="dot"></span></div>
            <div class="sub mono" data-layout-ignore>Charizard Base Set Unlimited · Asking $320</div>
          </div>
        </div>"""


def composer(pid):
    return f"""
        <div class="composer">
          <div class="tool" id="{pid}-t1">$</div>
          <div class="tool" id="{pid}-t2">{ic(PHONE, 32)}</div>
          <div class="tool" id="{pid}-t3">{ic(PIN, 32)}</div>
          <div class="input">Write a message</div>
          <div class="send mono" data-layout-ignore>Send</div>
        </div>"""


BODY = f"""
    <!-- the buyer's phone -->
    <div class="half" id="top">
      <div class="role mono"><b></b>Buyer · @ritacollects</div>{head('@mayapulls')}
      <div class="log">
        <div class="grp" id="tO">
          <div class="bub theirs" style="top: 0">Still available! Price is a bit negotiable for a quick pickup.<div class="meta mono" data-layout-ignore>2:14 pm</div></div>
          <div class="card mine" id="tOc" style="top: 160px; width: 470px;">
            <div class="k mono">Offer · Non-binding</div>
            <div class="v display">$290</div>
            <div class="n">Cash, this weekend?</div>
            <div class="status mono"><span id="tOsent" style="color: #7b8590">Sent</span><span id="tOok" style="color: #d6ff3f; opacity: 0">✓ Offer accepted</span></div>
          </div>
          <div class="pill" id="tOp" style="top: 396px; opacity: 0"><span class="mono">Offer accepted · $290</span></div>
        </div>
        <div class="grp" id="tN" style="opacity: 0">
          <div class="bub mine" style="top: 0">Deal! Send your number and let's pick a spot.<div class="meta mono" data-layout-ignore>2:16 pm</div></div>
          <div class="card theirs" id="tNc" style="top: 150px; width: 640px; opacity: 0">
            <div class="k mono">Phone number</div>
            <div class="num display"><img src="assets/img/flag-lb.svg" alt="" />+961 70 000 000</div>
            <div class="acts"><span class="btn acid mono">Call</span><span class="btn out mono" id="tNwa">WhatsApp</span></div>
          </div>
        </div>
        <div class="grp" id="tM" style="opacity: 0">
          <div class="bub theirs" style="top: 0">Got it. Where do we meet?<div class="meta mono" data-layout-ignore>2:17 pm</div></div>
          <div class="card mine" id="tMc" style="top: 130px; width: 600px; opacity: 0">
            <div class="k mono">You shared a location</div>
            <div class="place display">{ic(PIN, 34)}Zaitunay Bay, Beirut</div>
          </div>
        </div>
      </div>
      <div class="bar" id="tObar" style="top: 668px">
        <span class="barlab mono">Offer</span>
        <div class="field" style="width: 190px">$&nbsp;<span class="typed" id="tOamt">290</span></div>
        <div class="field" style="flex: 1" data-layout-ignore><span id="tOnote">Cash, this weekend?</span></div>
        <div class="btn acid mono" id="tOsend">Send offer</div>
      </div>
      <div class="bar" id="tMbar" style="top: 590px">
        <span class="barlab mono">Location</span>
        <div class="btn out mono">{ic(PIN, 24)}Use my current location</div>
        <div class="btn out mono" id="tMonmap">{ic(MAP, 24)}Choose on the map</div>
      </div>{composer('tc')}
      <div id="map">
        <div class="t display">Choose a meeting place</div>
        <div id="view">
          <img id="mapimg" src="assets/img/beirut-map.svg" alt="" data-layout-allow-overflow />
          <div id="pinwrap"><span class="mpin"></span></div>
          <div id="mcoords" class="mono" data-layout-ignore>33.90153, 35.49870</div>
          <div class="btn acid mono" id="muse">Use this spot</div>
        </div>
      </div>
    </div>

    <!-- the seller's phone -->
    <div class="half" id="bot">{head('@ritacollects')}
      <div class="log">
        <div class="grp" id="bO">
          <div class="bub mine" style="top: 0">Still available! Price is a bit negotiable for a quick pickup.<div class="meta mono" data-layout-ignore>2:14 pm</div></div>
          <div class="card theirs" id="bOc" style="top: 156px; width: 540px; opacity: 0">
            <div class="k mono">Offer · Non-binding</div>
            <div class="v display">$290</div>
            <div class="n">Cash, this weekend?</div>
            <div class="acts" id="bObtns"><span class="btn acid mono" id="bOacc">Accept</span><span class="btn no mono">Decline</span></div>
            <div class="mono" id="bOok" style="position: absolute; left: 26px; bottom: 30px; font-size: 22px; color: #d6ff3f; opacity: 0">✓ Offer accepted</div>
          </div>
        </div>
        <div class="grp" id="bN" style="opacity: 0">
          <div class="bub theirs" style="top: 0">Deal! Send your number and let's pick a spot.<div class="meta mono" data-layout-ignore>2:16 pm</div></div>
          <div class="card mine" id="bNc" style="top: 150px; width: 600px; opacity: 0">
            <div class="k mono">You shared your number</div>
            <div class="num display"><img src="assets/img/flag-lb.svg" alt="" />+961 70 000 000</div>
          </div>
        </div>
        <div class="grp" id="bM" style="opacity: 0">
          <div class="bub mine" id="bM1" style="top: 0">Got it. Where do we meet?<div class="meta mono" data-layout-ignore>2:17 pm</div></div>
          <div class="card theirs" id="bMc" style="top: 0; width: 680px; opacity: 0">
            <div class="k mono">Location</div>
            <div class="place display">{ic(PIN, 34)}Zaitunay Bay, Beirut</div>
            <div class="mini"><img src="assets/img/beirut-map.svg" alt="" data-layout-allow-overflow /><span class="mpin"></span></div>
            <div class="acts"><span class="btn acid mono">Google Maps</span><span class="btn out mono">Waze</span></div>
          </div>
        </div>
      </div>
      <div class="bar" id="bNbar" style="top: 488px">
        <span class="barlab mono">Phone</span>
        <div class="ccp"><img src="assets/img/flag-lb.svg" alt="" />+961<span style="color: #7b8590; font-size: 14px">▾</span></div>
        <div class="field" style="flex: 1"><span class="typed" id="bNnum">70 000 000</span></div>
        <div class="btn acid mono" id="bNsend">Share</div>
      </div>{composer('bc')}
      <div class="role mono"><b></b>Seller · @mayapulls</div>
    </div>

    <!-- the seam: what's happening, between the two phones -->
    <div id="seam">
      <div class="sl display" id="s0">Buyer ↑ · ↓ Seller</div>
      <div class="sl display" id="s1">01 · Offer</div>
      <div class="sl display" id="s1b">Accepted ✓</div>
      <div class="sl display" id="s2">02 · Number</div>
      <div class="sl display" id="s2b">Call or WhatsApp</div>
      <div class="sl display" id="s3">03 · Meetup</div>
      <div class="sl display" id="s3b">Opens in Maps &amp; Waze</div>
    </div>

    <div class="ring" id="ring"></div>
    <div id="finger"></div>

    <!-- the lime bookends: the type splits with the card -->
    <div class="cov" id="covT"><div class="covtext">
      <div class="ck mono">LebanonTCG · Messages</div>
      <div class="cw display w1">Two collectors.</div><div class="cw display w2" data-layout-allow-overflow>One chat.</div><div class="cw display w3">One meetup.</div>
    </div></div>
    <div class="cov" id="covB"><div class="covtext">
      <div class="ck mono">LebanonTCG · Messages</div>
      <div class="cw display w1">Two collectors.</div><div class="cw display w2" data-layout-allow-overflow>One chat.</div><div class="cw display w3">One meetup.</div>
    </div></div>

    <div id="out">
      <div id="see">{ic(PIN, 96)}<div class="a mono">See you at</div><div class="b display">Zaitunay<br>Bay.</div></div>
      <div id="lock"><img src="assets/img/flag.png" alt="" /><div class="w display">LebanonTCG.</div></div>
      <div id="tag" class="mono">We connect collectors.<br>You handle the deal.</div>
      <div id="url" class="mono">www.lebanontcg.com</div>
    </div>"""


def js():
    L = []
    a = L.append

    def typing(sel, text, n0, step_beats):
        a(f"      tl.set('{sel}', {{ width: '0ch' }}, 0);")
        for i in range(1, len(text) + 1):
            a(f"      tl.set('{sel}', {{ width: '{i}ch' }}, {T(n0 + (i - 1) * step_beats)});")

    def seam(new, old, n):
        if old:
            a(f"      tl.to('{old}', {{ opacity: 0, y: -50, duration: 0.18, ease: 'power2.in' }}, {T(n) - 0.18:.4f});")
        a(f"      tl.fromTo('{new}', {{ opacity: 0, y: 50 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'expo.out' }}, {T(n)});")

    def land(sel, n, origin='50% 100%'):
        a(f"      tl.fromTo('{sel}', {{ opacity: 0, y: 30, scale: 0.96, transformOrigin: '{origin}' }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.36, ease: 'expo.out' }}, {T(n)});")

    def bar(sel, n_open, n_close):
        a(f"      tl.fromTo('{sel}', {{ opacity: 0, y: 26 }}, {{ opacity: 1, y: 0, duration: 0.28, ease: 'expo.out' }}, {T(n_open)});")
        a(f"      tl.to('{sel}', {{ opacity: 0, y: 18, duration: 0.18, ease: 'power2.in' }}, {T(n_close) + 0.05:.4f});")

    def lit(sel, n0, n1):
        a(f"      tl.to('{sel}', {{ borderColor: '#d6ff3f', color: '#d6ff3f', duration: 0.12 }}, {T(n0)});")
        a(f"      tl.to('{sel}', {{ borderColor: '#2a3038', color: '#b9c2cc', duration: 0.2 }}, {T(n1)});")

    def tap(x, y, n, approach_from=None):
        """The fingertip glides in over the beat before, presses on the beat, lifts away."""
        fx, fy = approach_from or (x + 160, y + 220)
        a(f"      tl.fromTo('#finger', {{ x: {fx}, y: {fy}, opacity: 0, scale: 1 }}, {{ x: {x}, y: {y}, opacity: 1, duration: {B * 0.9:.3f}, ease: 'power3.out', immediateRender: false }}, {T(n - 1)});")
        a(f"      tl.to('#finger', {{ scale: 0.82, duration: 0.07, ease: 'power2.in', yoyo: true, repeat: 1 }}, {T(n) - 0.07:.4f});")
        a(f"      tl.fromTo('#ring', {{ x: {x}, y: {y}, opacity: 0.9, scale: 0.35 }}, {{ x: {x}, y: {y}, opacity: 0, scale: 1.3, duration: 0.45, ease: 'power2.out', immediateRender: false }}, {T(n)});")
        a(f"      tl.to('#finger', {{ opacity: 0, y: {y + 60}, duration: 0.25, ease: 'power2.in' }}, {T(n) + 0.22:.4f});")

    def press(sel, n):
        a(f"      tl.to('{sel}', {{ scale: 0.93, duration: 0.07, ease: 'power2.in', yoyo: true, repeat: 1 }}, {T(n) - 0.07:.4f});")

    a("      // Under the lime card nothing shows, so nothing is drawn: the phones appear as it opens")
    a(f"      tl.set(['#top', '#bot', '#seam'], {{ opacity: 1 }}, {T(6)});")
    a(f"      tl.set(['#covT', '#covB'], {{ opacity: 0 }}, {T(6) + B * 1.6 + 0.02:.4f});")
    a(f"      tl.set(['#covT', '#covB'], {{ opacity: 1 }}, {T(35)});")
    a(f"      tl.set(['#top', '#bot', '#seam'], {{ opacity: 0 }}, {T(36)});")
    a("      // ---- 1 · Hook: the lime card, one line per two beats -------------------------------")
    for cls, n in (('.w1', 0), ('.w2', 2), ('.w3', 4)):
        if n == 0:
            a(f"      tl.fromTo('{cls}', {{ scale: 1.06 }}, {{ scale: 1, duration: 0.4, ease: 'expo.out' }}, 0);  // on screen at frame 0 (the thumbnail)")
        else:
            a(f"      tl.fromTo('{cls}', {{ opacity: 0, scale: 1.3, filter: 'blur(10px)' }}, {{ opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.24, ease: 'expo.out' }}, {T(n)});")
    a(f"      tl.fromTo('.ck', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.3 }}, {T(0)});")
    a(f"      // beat 6 — the card splits along the middle line ('One chat.' is cut in two) and opens")
    a(f"      tl.to('#covT', {{ y: -960, duration: {B * 1.6:.3f}, ease: 'power3.inOut' }}, {T(6)});")
    a(f"      tl.to('#covB', {{ y: 960, duration: {B * 1.6:.3f}, ease: 'power3.inOut' }}, {T(6)});")
    a(f"      tl.fromTo(['#top', '#bot'], {{ scale: 1.04, filter: 'brightness(0.6)' }}, {{ scale: 1, filter: 'brightness(1)', duration: {B * 1.8:.3f}, ease: 'power2.out' }}, {T(6)});")
    seam('#s0', None, 7)

    a("      // ---- 2 · Offer -----------------------------------------------------------------------")
    seam('#s1', '#s0', 8)
    lit('#tc-t1', 8.5, 11)
    bar('#tObar', 9, 11)
    typing('#tOamt', '290', 9.5, 0.5)
    a(f"      tl.fromTo('#tOnote', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.15 }}, {T(10.5)});")
    press('#tOsend', 11)
    land('#tOc', 11, '100% 100%')
    land('#bOc', 11.5, '0% 100%')
    tap(159, 1538, 13)   # centres read from the layout in Chromium
    press('#bOacc', 13)
    a(f"      tl.to('#bObtns', {{ opacity: 0, duration: 0.15 }}, {T(13) + 0.1:.4f});")
    a(f"      tl.fromTo('#bOok', {{ opacity: 0, y: 8 }}, {{ opacity: 1, y: 0, duration: 0.25, ease: 'back.out(2)' }}, {T(13.5)});")
    a(f"      tl.to('#tOsent', {{ opacity: 0, duration: 0.12 }}, {T(13.5)});")
    a(f"      tl.fromTo('#tOok', {{ opacity: 0, y: 8 }}, {{ opacity: 1, y: 0, duration: 0.25, ease: 'back.out(2)' }}, {T(13.5)});")
    a(f"      tl.to(['#tOc', '#bOc'], {{ boxShadow: '0 0 46px -10px rgba(214, 255, 63, 0.75)', duration: 0.3 }}, {T(13.5)});")
    a(f"      tl.fromTo('#tOp', {{ opacity: 0, scale: 0.9 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.8)' }}, {T(14)});")
    seam('#s1b', '#s1', 13.5)

    a("      // ---- 3 · Number: the chats scroll on --------------------------------------------------")
    for old, new in (('#tO', '#tN'), ('#bO', '#bN')):
        a(f"      tl.to('{old}', {{ y: -120, opacity: 0, duration: 0.3, ease: 'power2.in' }}, {T(18) - 0.3:.4f});")
        a(f"      tl.fromTo('{new}', {{ y: 120, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.36, ease: 'expo.out' }}, {T(18)});")
    seam('#s2', '#s1b', 18)
    lit('#bc-t2', 18.5, 21)
    bar('#bNbar', 18.5, 21)
    typing('#bNnum', '70 000 000', 19, 0.25)
    press('#bNsend', 21)
    land('#bNc', 21, '100% 100%')
    land('#tNc', 21.5, '0% 100%')
    tap(302, 637, 23)
    a(f"      tl.to('#tNwa', {{ borderColor: '#d6ff3f', color: '#d6ff3f', duration: 0.12 }}, {T(23)});")
    seam('#s2b', '#s2', 23)

    a("      // ---- 4 · Meetup -----------------------------------------------------------------------")
    for old, new in (('#tN', '#tM'), ('#bN', '#bM')):
        a(f"      tl.to('{old}', {{ y: -120, opacity: 0, duration: 0.3, ease: 'power2.in' }}, {T(26) - 0.3:.4f});")
        a(f"      tl.fromTo('{new}', {{ y: 120, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.36, ease: 'expo.out' }}, {T(26)});")
    seam('#s3', '#s2b', 26)
    lit('#tc-t3', 26.5, 31)
    a(f"      tl.fromTo('#tMbar', {{ opacity: 0, y: 26 }}, {{ opacity: 1, y: 0, duration: 0.28, ease: 'expo.out' }}, {T(26.5)});")
    tap(253, 720, 27)
    a(f"      tl.to('#tMonmap', {{ borderColor: '#d6ff3f', color: '#d6ff3f', duration: 0.1 }}, {T(27)});")
    a(f"      // beat 28 — the map fills the buyer's phone and pans under the fixed pin; the pin drops on 30")
    a(f"      tl.fromTo('#map', {{ opacity: 0, y: 80 }}, {{ opacity: 1, y: 0, duration: 0.36, ease: 'expo.out' }}, {T(28)});")
    a(f"      tl.set(['#tMbar', '#top .composer'], {{ opacity: 0 }}, {T(28) + 0.36:.4f});")
    a(f"      tl.fromTo('#mapimg', {{ x: 320, y: 200 }}, {{ x: 0, y: 0, duration: {B * 2:.3f}, ease: 'power3.inOut' }}, {T(28)});")
    a(f"      tl.fromTo('#pinwrap', {{ y: -16 }}, {{ y: -16, duration: 0.01 }}, {T(28)});")
    a(f"      tl.to('#pinwrap', {{ y: 0, duration: 0.3, ease: 'bounce.out' }}, {T(30)});")
    a("      (function () {")
    a("        const el = document.querySelector('#mcoords');")
    a("        const p = { k: 0 };")
    a("        const show = () => {")
    a("          const lat = 33.89521 + (33.90153 - 33.89521) * p.k;")
    a("          const lng = 35.50455 + (35.49870 - 35.50455) * p.k;")
    a("          el.textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);")
    a("        };")
    a(f"        tl.fromTo(p, {{ k: 0 }}, {{ k: 1, duration: {B * 2:.3f}, ease: 'power3.inOut', onUpdate: show, onStart: show }}, {T(28)});")
    a("        tl.set(p, { k: 0, onComplete: show }, 0);")
    a("      })();")
    tap(933, 846, 31)
    press('#muse', 31)
    a(f"      tl.to('#map', {{ opacity: 0, y: 60, duration: 0.22, ease: 'power2.in' }}, {T(31.5)});")
    a(f"      tl.set('#top .composer', {{ opacity: 1 }}, {T(31.5) + 0.22:.4f});")
    land('#tMc', 32, '100% 100%')
    a(f"      tl.to('#bM1', {{ y: -110, opacity: 0, duration: 0.25, ease: 'power2.in' }}, {T(32) - 0.15:.4f});")
    land('#bMc', 32, '0% 0%')
    seam('#s3b', '#s3', 33)

    a("      // ---- 5 · Outro: the lime closes over both phones ----------------------------------------")
    a(f"      tl.set('.covtext', {{ opacity: 0 }}, {T(35)});")
    a(f"      tl.to('#covT', {{ y: 0, duration: {B * 0.9:.3f}, ease: 'power3.inOut' }}, {T(35.1)});")
    a(f"      tl.to('#covB', {{ y: 0, duration: {B * 0.9:.3f}, ease: 'power3.inOut' }}, {T(35.1)});")
    a(f"      tl.fromTo('#see', {{ opacity: 0, y: 40 }}, {{ opacity: 1, y: 0, duration: 0.32, ease: 'expo.out' }}, {T(36)});")
    a(f"      tl.to('#see', {{ opacity: 0, y: -40, duration: 0.22, ease: 'power2.in' }}, {T(40) - 0.22:.4f});")
    a(f"      tl.fromTo('#lock', {{ opacity: 0, scale: 0.9 }}, {{ opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.4)' }}, {T(40)});")
    a(f"      tl.fromTo('#tag', {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }}, {T(40.5)});")
    a(f"      tl.fromTo('#url', {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }}, {T(40.75)});")
    return '\n'.join(L)


FILM = f"""<template>
  <style>{CSS}
  </style>

  <div id="root" data-composition-id="film" data-width="1080" data-height="1920">{BODY}
  </div>

  <script>
    (function () {{
      // Beats at {BPM} BPM: beat n is at n x {B:.6f} s. The soundtrack uses the same beat numbers.
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
    <title>LebanonTCG two phones</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #08090b; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #08090b; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1920">
      <!-- One continuous scene: the split screen persists from the lime card to the lime card. -->
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
