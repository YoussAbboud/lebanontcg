"""Writes composition/index.html and composition/compositions/film.html.

"Three strikes": one continuous scene — the site panel on the left runs the troll's day, the
captions on the right count. Every cue is a beat at 100 BPM (B = 0.6 s), written as T(n); the
soundtrack (work/synth.py) uses the same beat numbers.
"""
import os

HERE = os.path.dirname(__file__)
COMP = os.path.join(HERE, 'composition')
BPM = 100
B = 60 / BPM
BEATS = 38
DUR = round(BEATS * B, 4)


def T(n):
    return round(n * B, 4)


# The "troll photo": a drawn desk fan, no real photo of anyone's room.
FAN = """<svg class="fan" viewBox="0 0 380 300" width="{w}" height="{h}" preserveAspectRatio="xMidYMid slice">
  <rect width="380" height="300" fill="#e7e1d8"/>
  <rect y="228" width="380" height="72" fill="#cfc7bb"/>
  <rect y="226" width="380" height="4" fill="#b7ae a1" opacity="0.6"/>
  <ellipse cx="190" cy="262" rx="78" ry="16" fill="#1f6f6b"/>
  <rect x="150" y="246" width="80" height="22" rx="8" fill="#2a8d88"/>
  <rect x="180" y="150" width="20" height="100" fill="#8f98a3"/>
  <circle cx="190" cy="118" r="92" fill="#2a8d88"/>
  <circle cx="190" cy="118" r="82" fill="#eef1f4"/>
  <g stroke="#b7c0ca" stroke-width="2.2" fill="none">
    <circle cx="190" cy="118" r="70"/><circle cx="190" cy="118" r="56"/><circle cx="190" cy="118" r="42"/><circle cx="190" cy="118" r="28"/>
    <path d="M190 36v164M108 118h164M132 60l116 116M248 60L132 176M156 42l68 152M224 42l-68 152M114 84l152 68M114 152l152-68"/>
  </g>
  <circle cx="190" cy="118" r="14" fill="#2a8d88"/>
</svg>"""


def fan(w, h):
    return FAN.replace('#b7ae a1', '#b7aea1').format(w=w, h=h)


PIN = '<svg class="ic" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'
PHONE = '<svg class="ic" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>'


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

    /* ---- the site panel ---------------------------------------------------------------------- */
    #site { position: absolute; left: 96px; top: 96px; width: 1060px; height: 888px; border-radius: 28px; overflow: hidden;
      background: #0b0c10; border: 2px solid #1b1f25; box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55); }
    #bar { position: absolute; left: 0; right: 0; top: 0; height: 84px; display: flex; align-items: center; gap: 18px; padding: 0 36px; border-bottom: 2px solid rgba(255, 255, 255, 0.06); }
    #bar img { width: 34px; height: 34px; }
    #bar .wm { font-size: 30px; letter-spacing: 0.02em; }
    #bar .wm b { color: #d6ff3f; }
    #bar .nav { margin-left: auto; display: flex; gap: 26px; font-size: 18px; color: #b9c2cc; }
    #bar .cta { height: 48px; padding: 0 22px; border-radius: 999px; background: #d6ff3f; color: #08090b; display: flex; align-items: center; font-size: 17px; }
    .view { position: absolute; left: 0; right: 0; top: 84px; bottom: 0; opacity: 0; }

    /* the sell page's review step */
    #sell .h { position: absolute; left: 48px; top: 40px; font-size: 40px; }
    #sell .sub { position: absolute; left: 48px; top: 96px; font-size: 22px; color: #b9c2cc; }
    .lcard { position: absolute; left: 48px; top: 150px; width: 380px; border-radius: 22px; overflow: hidden; background: #16191e; border: 2px solid #22272e; }
    .lcard .row { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; font-size: 20px; }
    .lcard .row .likes { display: flex; align-items: center; gap: 8px; color: #b9c2cc; font-size: 18px; }
    .lcard .face { position: relative; height: 300px; overflow: hidden; }
    .lcard .face svg { display: block; }
    .lcard .tag { position: absolute; left: 12px; top: 12px; height: 36px; padding: 0 14px; border-radius: 999px; border: 2px solid #ffc45e; color: #ffc45e; background: rgba(8, 9, 11, 0.85); font-size: 15px; display: flex; align-items: center; opacity: 0; }
    .lcard .t { padding: 16px 18px 4px; font-size: 30px; line-height: 1.1; }
    .lcard .m { padding: 0 18px; font-size: 15px; color: #7b8590; }
    .lcard .p { padding: 10px 18px 18px; font-size: 40px; }
    .scan { position: absolute; left: 0; right: 0; top: 0; height: 6px; background: #d6ff3f; box-shadow: 0 0 24px 6px rgba(214, 255, 63, 0.55); opacity: 0; }
    .scanwash { position: absolute; left: 0; right: 0; top: 0; height: 300px; transform-origin: 50% 0; background: linear-gradient(to bottom, rgba(214, 255, 63, 0) 0%, rgba(214, 255, 63, 0.22) 100%); }
    .verdict { position: absolute; left: 500px; top: 300px; width: 500px; opacity: 0; }
    #k2-v { top: 450px; }
    .verdict .chip { display: inline-flex; align-items: center; height: 40px; padding: 0 16px; border-radius: 999px; border: 2px solid #ff5c8a; color: #ff5c8a; font-size: 17px; }
    .verdict .why { margin-top: 10px; font-size: 21px; color: #b9c2cc; }
    #right { position: absolute; left: 500px; top: 150px; width: 500px; }
    #right .note { font-size: 24px; line-height: 1.5; color: #b9c2cc; }
    #right .note b { color: #f2f5f7; font-weight: 600; }
    .publish { position: absolute; left: 500px; top: 560px; width: 372px; height: 68px; padding: 0 30px; border-radius: 999px; background: #d6ff3f; color: #08090b; display: flex; align-items: center; font-size: 21px; white-space: nowrap; }
    .publish span { position: absolute; left: 30px; top: 0; height: 68px; display: flex; align-items: center; }
    #cool { position: absolute; left: 500px; top: 150px; width: 500px; padding: 22px 24px; border-radius: 20px; border: 2px solid #ffc45e; background: rgba(255, 196, 94, 0.07); opacity: 0; }
    #cool .big { font-size: 29px; line-height: 1.3; color: #ffc45e; font-weight: 600; }
    #cool .big .sec { display: inline-grid; }
    #cool .big .sec span { grid-area: 1 / 1; opacity: 0; }
    #cool .big .sec span.on { opacity: 1; }
    #cool p { margin-top: 12px; font-size: 21px; line-height: 1.45; color: #b9c2cc; }

    /* the moderator's queue */
    #adm .h { position: absolute; left: 48px; top: 36px; font-size: 40px; }
    #adm .tabs { position: absolute; left: 48px; top: 104px; display: flex; gap: 12px; }
    #adm .tab { height: 44px; padding: 0 20px; border-radius: 999px; border: 2px solid #2a3038; color: #b9c2cc; display: flex; align-items: center; gap: 10px; font-size: 16px; }
    #adm .tab.on { background: #d6ff3f; color: #08090b; border-color: #d6ff3f; }
    #adm .tab i { width: 24px; height: 24px; border-radius: 50%; background: #08090b; color: #d6ff3f; display: flex; align-items: center; justify-content: center; font-style: normal; font-size: 14px; }
    #acard { position: absolute; left: 48px; top: 180px; width: 964px; padding: 26px 30px 28px; border-radius: 22px; background: #121418; border: 2px solid #22272e; opacity: 0; }
    #acard .top { display: flex; align-items: flex-start; justify-content: space-between; }
    #acard .ttl { font-size: 32px; }
    #acard .meta { margin-top: 6px; font-size: 16px; color: #7b8590; }
    #acard .chip { height: 40px; padding: 0 16px; border-radius: 999px; border: 2px solid #ff5c8a; color: #ff5c8a; font-size: 17px; display: flex; align-items: center; white-space: nowrap; }
    #acard .photos { display: flex; gap: 10px; margin-top: 20px; }
    #acard .ph { width: 150px; height: 210px; border-radius: 12px; overflow: hidden; border: 2px solid #2a3038; }
    #acard .why { margin-top: 18px; font-size: 22px; color: #b9c2cc; }
    #acard .who { margin-top: 10px; font-size: 16px; color: #7b8590; }
    #acard .acts { display: flex; gap: 14px; margin-top: 22px; }
    .btn { height: 60px; border-radius: 999px; display: inline-flex; align-items: center; gap: 12px; padding: 0 28px; font-size: 19px; white-space: nowrap; }
    .btn.acid { background: #d6ff3f; color: #08090b; }
    .btn.out { border: 2px solid #2a3038; color: #e6eaee; }
    .btn.no { border: 2px solid rgba(255, 92, 138, 0.6); color: #ff5c8a; }

    /* the troll's screen: the notification, the red bar, the chat */
    #trl .ntf { position: absolute; right: 36px; top: 20px; width: 440px; padding: 16px 20px; border-radius: 16px; background: #16191e; border: 2px solid #ffc45e; opacity: 0; }
    #trl .ntf .k { font-size: 14px; color: #ffc45e; }
    #trl .ntf .v { margin-top: 6px; font-size: 22px; font-weight: 600; }
    #trl .ntf .b { margin-top: 4px; font-size: 17px; color: #b9c2cc; }
    #susp { position: absolute; left: 36px; right: 36px; top: 20px; padding: 18px 22px; border-radius: 16px; border: 2px solid #ff5c8a; background: rgba(255, 92, 138, 0.1); font-size: 23px; line-height: 1.45; color: #e6eaee; opacity: 0; }
    #susp b { color: #ff5c8a; font-weight: 600; }
    #susp .lnk { color: #d6ff3f; }
    #chat { position: absolute; left: 36px; right: 36px; top: 190px; bottom: 0; }
    #chat .head { display: flex; align-items: center; gap: 18px; padding-bottom: 18px; border-bottom: 2px solid rgba(255, 255, 255, 0.06); }
    #chat .head .th { width: 56px; height: 74px; border-radius: 10px; background: radial-gradient(circle at 35% 22%, #ff9d4d, #9b3a12 80%); border: 2px solid rgba(255, 157, 77, 0.6); }
    #chat .head .who { font-size: 26px; font-weight: 600; }
    #chat .head .sub { font-size: 16px; color: #b9c2cc; margin-top: 4px; }
    #chat .head .acts { margin-left: auto; display: flex; gap: 12px; }
    #chat .bub { margin-top: 22px; display: inline-block; max-width: 620px; padding: 16px 22px 12px; border-radius: 22px; background: #16191e; border: 2px solid rgba(255, 255, 255, 0.08); font-size: 23px; line-height: 1.35; }
    #chat .bub .meta { font-size: 14px; margin-top: 6px; color: #7b8590; }
    #lockline { margin-top: 24px; font-size: 16px; color: #ff5c8a; opacity: 0; }
    #lockline .lnk { color: #d6ff3f; text-decoration: underline; }
    #comp { position: absolute; left: 0; right: 0; bottom: 36px; display: flex; gap: 14px; align-items: center; }
    .tool { width: 68px; height: 68px; border-radius: 50%; border: 2px solid #2a3038; display: flex; align-items: center; justify-content: center; color: #b9c2cc; font-family: 'LTCG Mono', monospace; font-size: 26px; flex: none; }
    .input { flex: 1; height: 68px; border-radius: 999px; border: 2px solid #2a3038; background: #16191e; color: #7b8590; font-size: 23px; display: flex; align-items: center; padding: 0 26px; position: relative; }
    .input span { position: absolute; left: 26px; top: 0; height: 68px; display: flex; align-items: center; }
    .send { height: 68px; padding: 0 28px; border-radius: 999px; background: #8aa324; color: #08090b; display: flex; align-items: center; font-size: 19px; }
    #dim { position: absolute; inset: 0; }

    /* ---- the right side: strikes and captions ----------------------------------------------- */
    #strikes { position: absolute; left: 1240px; top: 112px; display: flex; align-items: center; gap: 18px; }
    #strikes .lab { font-size: 22px; color: #7b8590; margin-right: 8px; }
    .sdot { width: 34px; height: 34px; border-radius: 50%; border: 3px solid #2a3038; background: #0e1013; }
    .cap { position: absolute; left: 1240px; width: 600px; opacity: 0; }
    .cap .big { font-size: 78px; line-height: 1.02; letter-spacing: 0.01em; }
    .cap .mid { font-size: 60px; line-height: 1.05; }
    .cap .sm { margin-top: 26px; font-size: 30px; color: #d6ff3f; line-height: 1.4; }
    #c1 { top: 330px; }
    #c2 { top: 300px; }
    #c3a, #c4a { top: 330px; }
    #c3b, #c4b { top: 300px; }
    #c4b .sm { color: #ff5c8a; }

    /* ---- the fingertip --------------------------------------------------------------------- */
    #finger { position: absolute; left: 0; top: 0; width: 64px; height: 64px; margin: -32px 0 0 -32px; border-radius: 50%;
      background: rgba(255, 255, 255, 0.82); border: 3px solid rgba(8, 9, 11, 0.35); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); opacity: 0; z-index: 30; }
    .ring { position: absolute; left: 0; top: 0; width: 100px; height: 100px; margin: -50px 0 0 -50px; border-radius: 50%; border: 5px solid #d6ff3f; opacity: 0; z-index: 29; }

    /* ---- the outro ------------------------------------------------------------------------- */
    #out { position: absolute; inset: 0; background: #08090b; opacity: 0; z-index: 25; }
    #nojunk { position: absolute; left: 0; right: 0; top: 410px; text-align: center; font-size: 190px; line-height: 1; color: #d6ff3f; opacity: 0; }
    #lock { position: absolute; left: 0; right: 0; top: 300px; display: flex; flex-direction: column; align-items: center; gap: 34px; opacity: 0; }
    #lock img { width: 170px; height: 170px; }
    #lock .w { font-size: 120px; line-height: 1; letter-spacing: 0.04em; }
    #tag { position: absolute; left: 0; right: 0; top: 720px; text-align: center; font-size: 30px; letter-spacing: 0.14em; color: #b9c2cc; opacity: 0; }
    #url { position: absolute; left: 0; right: 0; top: 790px; text-align: center; font-size: 40px; letter-spacing: 0.05em; text-transform: none; color: #d6ff3f; opacity: 0; }
"""


def card(cid, title, meta, price):
    return f"""
        <div class="lcard" id="{cid}">
          <div class="row"><span class="mono" data-layout-ignore>@junkdealer</span><span class="likes mono" data-layout-ignore>♡ 0</span></div>
          <div class="face">{fan(380, 300)}<div class="scanwash" id="{cid}-wash"></div><div class="scan" id="{cid}-scan" data-layout-allow-overflow></div><div class="tag mono" id="{cid}-tag" data-layout-ignore>In review</div></div>
          <div class="t display">{title}</div>
          <div class="m mono" data-layout-ignore>{meta}</div>
          <div class="p display">{price}</div>
        </div>
        <div class="verdict" id="{cid}-v"><span class="chip mono">Check: not a card</span><div class="why">The photos do not show a trading card.</div></div>"""


SECS = [57, 56, 55, 54, 53, 52]
BODY = f"""
    <div id="site">
      <div id="bar">
        <img src="assets/img/flag.png" alt="" />
        <div class="wm display">LebanonTCG <b>.</b></div>
        <div class="nav mono" data-layout-ignore><span>Home</span><span>Browse</span><span>Sellers</span><span>Messages</span></div>
        <div class="cta mono" data-layout-ignore>List a card</div>
      </div>

      <!-- the sell page, review step -->
      <div class="view" id="sell">
        <div class="h display">Review</div>
        <div class="sub">This is how your card appears in the grid.</div>
        {card('k1', 'Charizard Holo', 'Pokémon · Base Set', '$320')}
        {card('k2', 'Rare Pikachu', 'Pokémon · Base Set', '$50')}
        <div id="right"><div class="note">LebanonTCG doesn't handle payment or shipping. <b>Listings go live once a quick check confirms the photos show a card.</b></div></div>
        <div class="publish mono" id="pub"><span id="pub1">Publish listing</span><span id="pub2" style="opacity: 0">Checking your photos…</span>&nbsp;</div>
        <div id="cool">
          <div class="big">You can't list at the moment. Try again in 9 minutes <span class="sec">{''.join(f'<span id="s{s}">{s}</span>' for s in SECS)}</span> seconds.</div>
          <p>Two of your latest listings went to review instead of going live, so listing is paused for a few minutes. Listings need clear photos of the actual card.</p>
        </div>
      </div>

      <!-- the moderator's approvals queue -->
      <div class="view" id="adm">
        <div class="h display">Admin console</div>
        <div class="tabs mono" data-layout-ignore><span class="tab">Overview</span><span class="tab">Reports</span><span class="tab on">Approvals <i>2</i></span><span class="tab">Users</span><span class="tab">Listings</span></div>
        <div id="acard">
          <div class="top">
            <div><div class="ttl display">Rare Pikachu</div><div class="meta mono" data-layout-ignore>Pokémon · Base Set · $50</div></div>
            <span class="chip mono">Check: not a card</span>
          </div>
          <div class="photos"><div class="ph">{fan(150, 210)}</div></div>
          <div class="why">The photos do not show a trading card.</div>
          <div class="who mono" data-layout-ignore>@junkdealer · listed just now · checked 2 times</div>
          <div class="acts"><span class="btn acid mono">Approve</span><span class="btn no mono">Reject</span><span class="btn no mono" id="rw">Reject &amp; warn</span></div>
        </div>
      </div>

      <!-- the troll's screen -->
      <div class="view" id="trl">
        <div id="dim">
          <div id="chat">
            <div class="head">
              <div class="th"></div>
              <div><div class="who">@mayapulls</div><div class="sub mono" data-layout-ignore>Charizard Base Set Unlimited · Asking $320</div></div>
              <div class="acts"><span class="btn out mono" id="likeb">♡ 12</span><span class="btn acid mono" id="bidb">Message seller</span></div>
            </div>
            <div class="bub">Still available! Price is a bit negotiable for a quick pickup.<div class="meta mono" data-layout-ignore>2:14 pm</div></div>
            <div id="lockline" class="mono">Your account is suspended — you can read this chat but not reply. <span class="lnk">Contact support</span></div>
            <div id="comp">
              <div class="tool">$</div><div class="tool">{ic(PHONE, 26)}</div><div class="tool">{ic(PIN, 26)}</div>
              <div class="input"><span id="ph1">Write a message</span><span id="ph2" style="opacity: 0">Your account is suspended</span>&nbsp;</div>
              <div class="send mono" data-layout-ignore>Send</div>
            </div>
          </div>
        </div>
        <div class="ntf" id="ntf"><div class="k mono" data-layout-ignore>Moderation</div><div class="v">Warning 3 of 3 — Rare Pikachu</div><div class="b">Posting junk listings.</div></div>
        <div id="susp"><b>Your account is suspended.</b> Posting junk listings. You can browse and read your chats, but you can't list, message, like, bid, report or review. <span class="lnk">Contact support</span> to appeal.</div>
      </div>
    </div>

    <div id="strikes"><span class="lab mono">Strikes</span><span class="sdot" id="d1"></span><span class="sdot" id="d2"></span><span class="sdot" id="d3"></span></div>

    <div class="cap" id="c1"><div class="big display">This is not a Charizard.</div></div>
    <div class="cap" id="c2"><div class="mid display">Every listing is checked before it goes live.</div><div class="sm mono" id="c2s">Not a card? Nobody sees it.</div></div>
    <div class="cap" id="c3a"><div class="big display">They try again.</div></div>
    <div class="cap" id="c3b"><div class="mid display">Two in a row? Ten-minute cooldown.</div><div class="sm mono">And the clock is on their screen.</div></div>
    <div class="cap" id="c4a"><div class="big display">They keep going.</div></div>
    <div class="cap" id="c4b"><div class="mid display">Three warnings. Suspended.</div><div class="sm mono">On the spot — no reload, no way around it.</div></div>

    <div class="ring" id="ring"></div>
    <div id="finger"></div>

    <div id="out">
      <div id="nojunk" class="display">No junk.</div>
      <div id="lock"><img src="assets/img/flag.png" alt="" /><div class="w display">LebanonTCG.</div></div>
      <div id="tag" class="mono">We connect collectors. You handle the deal.</div>
      <div id="url" class="mono">www.lebanontcg.com</div>
    </div>"""


# Fingertip targets: centres read from the layout in Chromium (work/probe.mjs), overwritten there.
TAPS = {'pub': (782, 776), 'rw': (604, 822)}


def js():
    L = []
    a = L.append

    def cap_in(sel, n, dy=40):
        a(f"      tl.fromTo('{sel}', {{ opacity: 0, y: {dy} }}, {{ opacity: 1, y: 0, duration: 0.34, ease: 'expo.out' }}, {T(n)});")

    def cap_out(sel, n):
        a(f"      tl.to('{sel}', {{ opacity: 0, y: -40, duration: 0.2, ease: 'power2.in' }}, {T(n) - 0.2:.4f});")

    def land(sel, n, origin='50% 100%', dur=0.36):
        a(f"      tl.fromTo('{sel}', {{ opacity: 0, y: 30, scale: 0.96, transformOrigin: '{origin}' }}, {{ opacity: 1, y: 0, scale: 1, duration: {dur}, ease: 'expo.out' }}, {T(n)});")

    def tap(x, y, n, approach_from=None):
        fx, fy = approach_from or (x + 150, y + 200)
        a(f"      tl.fromTo('#finger', {{ x: {fx}, y: {fy}, opacity: 0, scale: 1 }}, {{ x: {x}, y: {y}, opacity: 1, duration: {B * 0.9:.3f}, ease: 'power3.out', immediateRender: false }}, {T(n - 1)});")
        a(f"      tl.to('#finger', {{ scale: 0.82, duration: 0.07, ease: 'power2.in', yoyo: true, repeat: 1 }}, {T(n) - 0.07:.4f});")
        a(f"      tl.fromTo('#ring', {{ x: {x}, y: {y}, opacity: 0.9, scale: 0.35 }}, {{ x: {x}, y: {y}, opacity: 0, scale: 1.3, duration: 0.45, ease: 'power2.out', immediateRender: false }}, {T(n)});")
        a(f"      tl.to('#finger', {{ opacity: 0, y: {y + 60}, duration: 0.25, ease: 'power2.in' }}, {T(n) + 0.22:.4f});")

    def press(sel, n):
        a(f"      tl.to('{sel}', {{ scale: 0.93, duration: 0.07, ease: 'power2.in', yoyo: true, repeat: 1 }}, {T(n) - 0.07:.4f});")

    def scan(cid, n0, n1):
        d = T(n1) - T(n0)
        a(f"      tl.fromTo('#{cid}-scan', {{ y: 0, opacity: 1 }}, {{ y: 296, opacity: 1, duration: {d:.3f}, ease: 'none', immediateRender: false }}, {T(n0)});")
        a(f"      tl.fromTo('#{cid}-wash', {{ scaleY: 0 }}, {{ scaleY: 1, duration: {d:.3f}, ease: 'none' }}, {T(n0)});")
        a(f"      tl.to('#{cid}-scan', {{ opacity: 0, duration: 0.12 }}, {T(n1)});")
        a(f"      tl.to('#{cid}-wash', {{ opacity: 0, duration: 0.3 }}, {T(n1)});")

    def verdict(cid, n):
        a(f"      tl.fromTo('#{cid}-v', {{ opacity: 0, y: 16 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'expo.out' }}, {T(n)});")
        a(f"      tl.fromTo('#{cid}-tag', {{ opacity: 0, scale: 0.8 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }}, {T(n) + 0.1:.4f});")
        a(f"      tl.to('#{cid} .face svg', {{ filter: 'saturate(0.35) brightness(0.8)', duration: 0.3 }}, {T(n)});")

    def strike(k, n):
        a(f"      tl.to('#d{k}', {{ backgroundColor: '#ff5c8a', borderColor: '#ff5c8a', boxShadow: '0 0 22px rgba(255, 92, 138, 0.8)', duration: 0.12 }}, {T(n)});")
        a(f"      tl.fromTo('#d{k}', {{ scale: 1.5 }}, {{ scale: 1, duration: 0.4, ease: 'back.out(2)', immediateRender: false }}, {T(n)});")

    a("      // ---- 1 · The listing (beats 0-6) --------------------------------------------------------")
    a("      tl.set('#sell', { opacity: 1 }, 0);")
    a("      tl.set('#k2', { opacity: 0 }, 0);")
    a("      tl.fromTo('#site', { scale: 1.03, y: 14 }, { scale: 1, y: 0, duration: 0.5, ease: 'expo.out' }, 0);  // on screen at frame 0 (the thumbnail)")
    a("      tl.fromTo('#strikes', { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.2);")
    a("      // beat 1 — the line lands (a hit in the soundtrack)")
    a(f"      tl.fromTo('#c1', {{ opacity: 0, scale: 1.25, filter: 'blur(10px)' }}, {{ opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.3, ease: 'expo.out' }}, {T(1)});")
    tap(*TAPS['pub'], 4)
    press('#pub', 4)
    a(f"      tl.to('#pub1', {{ opacity: 0, duration: 0.1 }}, {T(4)});")
    a(f"      tl.to('#pub2', {{ opacity: 1, duration: 0.15 }}, {T(4) + 0.08:.4f});")
    a(f"      tl.to('#pub', {{ backgroundColor: '#8aa324', duration: 0.15 }}, {T(4)});")
    cap_out('#c1', 6)

    a("      // ---- 2 · The check (6-13) ---------------------------------------------------------------")
    scan('k1', 6, 8)
    verdict('k1', 8)
    strike(1, 8)
    a(f"      tl.to('#pub', {{ backgroundColor: '#22272e', color: '#b9c2cc', duration: 0.2 }}, {T(8)});")
    cap_in('#c2', 8.5)
    a(f"      tl.set('#c2s', {{ opacity: 0 }}, 0);")
    a(f"      tl.fromTo('#c2s', {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'expo.out' }}, {T(10)});")
    cap_out('#c2', 13)

    a("      // ---- 3 · The cooldown (13-22) -------------------------------------------------------------")
    cap_in('#c3a', 13)
    a(f"      tl.to(['#k1', '#k1-v'], {{ opacity: 0, x: -40, duration: 0.25, ease: 'power2.in' }}, {T(13.5) - 0.25:.4f});")
    a(f"      tl.fromTo('#k2', {{ opacity: 0, x: 60 }}, {{ opacity: 1, x: 0, duration: 0.34, ease: 'expo.out' }}, {T(13.5)});")
    a(f"      tl.set('#pub1', {{ opacity: 1 }}, {T(13.5)});")
    a(f"      tl.set('#pub2', {{ opacity: 0 }}, {T(13.5)});")
    a(f"      tl.set('#pub', {{ backgroundColor: '#d6ff3f', color: '#08090b' }}, {T(13.5)});")
    scan('k2', 14, 15)
    verdict('k2', 15)
    strike(2, 15)
    a("      // beat 16 — the cooldown banner replaces the note; Publish greys out")
    a(f"      tl.to('#right', {{ opacity: 0, y: -16, duration: 0.2, ease: 'power2.in' }}, {T(16) - 0.2:.4f});")
    a(f"      tl.fromTo('#cool', {{ opacity: 0, y: 30, scale: 0.97 }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.34, ease: 'expo.out' }}, {T(16)});")
    a(f"      tl.to('#pub', {{ backgroundColor: '#22272e', color: '#b9c2cc', duration: 0.2 }}, {T(16)});")
    a(f"      tl.set('#s{SECS[0]}', {{ opacity: 1 }}, 0);")
    for i in range(1, len(SECS)):
        a(f"      tl.set('#s{SECS[i - 1]}', {{ opacity: 0 }}, {T(16 + i)});")
        a(f"      tl.set('#s{SECS[i]}', {{ opacity: 1 }}, {T(16 + i)});")
    cap_out('#c3a', 16.5)
    cap_in('#c3b', 16.5)
    cap_out('#c3b', 22)

    a("      // ---- 4 · The suspension (22-31) ----------------------------------------------------------")
    cap_in('#c4a', 22)
    a(f"      tl.to('#sell', {{ opacity: 0, duration: 0.2 }}, {T(22.5) - 0.2:.4f});")
    a(f"      tl.set('#adm', {{ opacity: 1 }}, {T(22.5) - 0.2:.4f});")
    land('#acard', 22.5, '50% 0%')
    tap(*TAPS['rw'], 24)
    press('#rw', 24)
    a(f"      tl.to('#rw', {{ backgroundColor: '#ff5c8a', color: '#08090b', duration: 0.12 }}, {T(24)});")
    a("      // beat 25 — the troll's screen: the warning lands")
    a(f"      tl.to('#adm', {{ opacity: 0, duration: 0.2 }}, {T(25) - 0.25:.4f});")
    a(f"      tl.set('#trl', {{ opacity: 1 }}, {T(25) - 0.25:.4f});")
    a(f"      tl.fromTo('#ntf', {{ opacity: 0, y: -30 }}, {{ opacity: 1, y: 0, duration: 0.34, ease: 'expo.out' }}, {T(25)});")
    strike(3, 25)
    a("      // beat 26 — the slam: the red bar, and everything under it locks")
    a(f"      tl.to('#ntf', {{ opacity: 0, y: -20, duration: 0.15, ease: 'power2.in' }}, {T(26) - 0.15:.4f});")
    a(f"      tl.fromTo('#susp', {{ opacity: 0, scale: 1.08, y: -20 }}, {{ opacity: 1, scale: 1, y: 0, duration: 0.22, ease: 'expo.out' }}, {T(26)});")
    a(f"      tl.fromTo('#site', {{ x: 0 }}, {{ x: -10, duration: 0.05, yoyo: true, repeat: 3, immediateRender: false }}, {T(26)});")
    a(f"      tl.to(['#likeb', '#bidb', '#comp .tool', '#comp .send'], {{ opacity: 0.35, filter: 'saturate(0)', duration: 0.3 }}, {T(26) + 0.1:.4f});")
    a(f"      tl.to('#ph1', {{ opacity: 0, duration: 0.1 }}, {T(26) + 0.1:.4f});")
    a(f"      tl.to('#ph2', {{ opacity: 1, duration: 0.2 }}, {T(26) + 0.2:.4f});")
    a(f"      tl.fromTo('#lockline', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.25 }}, {T(26) + 0.3:.4f});")
    cap_out('#c4a', 26.8)
    cap_in('#c4b', 27)

    a("      // ---- 5 · Outro (31-38) --------------------------------------------------------------------")
    a(f"      tl.to('#out', {{ opacity: 1, duration: 0.2 }}, {T(31) - 0.2:.4f});")
    a(f"      tl.set(['#site', '#strikes', '#c4b'], {{ opacity: 0 }}, {T(31)});")
    a(f"      tl.fromTo('#nojunk', {{ opacity: 0, scale: 1.3, filter: 'blur(12px)' }}, {{ opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.3, ease: 'expo.out' }}, {T(31)});")
    a(f"      tl.to('#nojunk', {{ opacity: 0, scale: 0.9, duration: 0.22, ease: 'power2.in' }}, {T(34) - 0.22:.4f});")
    a(f"      tl.fromTo('#lock', {{ opacity: 0, scale: 0.9 }}, {{ opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.4)' }}, {T(34)});")
    a(f"      tl.fromTo('#tag', {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }}, {T(35)});")
    a(f"      tl.fromTo('#url', {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }}, {T(35.25)});")
    return '\n'.join(L)


FILM = f"""<template>
  <style>{CSS}
  </style>

  <div id="root" data-composition-id="film" data-width="1920" data-height="1080">{BODY}
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
    <meta name="viewport" content="width=1920, height=1080" />
    <title>LebanonTCG three strikes</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #08090b; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #08090b; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1920" data-height="1080">
      <!-- One continuous scene: the site panel runs the troll's day, the captions count. -->
      <div id="film" data-composition-id="film" data-composition-src="compositions/film.html"
        data-start="0" data-duration="{DUR}" data-track-index="1" data-track-kind="graphics"
        data-width="1920" data-height="1080"></div>
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
