"""The 1080x1920 cut: build_film.py's timeline, re-laid for a phone.

Captions sit on top inside the title-safe box, the site panel fills the lower two thirds, and
the "junk photo" is the supplied fan picture (assets/img/fan.jpg) instead of the drawing. The
same soundtrack and the same beat numbers; only the geometry changes. Writes composition-v/.
"""
import os

HERE = os.path.dirname(__file__)
src = open(os.path.join(HERE, 'build_film.py')).read()


def rep(old, new, count=1):
    global src
    assert src.count(old) >= count and old in src, old[:80]
    src = src.replace(old, new, count)


# ---- where it writes ------------------------------------------------------------------------
rep("COMP = os.path.join(HERE, 'composition')", "COMP = os.path.join(HERE, 'composition-v')")

# ---- the frame ----------------------------------------------------------------------------
rep('data-width="1920" data-height="1080"', 'data-width="1080" data-height="1920"', 3)
rep('content="width=1920, height=1080"', 'content="width=1080, height=1920"')
rep('width: 1920px; height: 1080px;', 'width: 1080px; height: 1920px;')
rep('<title>LebanonTCG three strikes</title>', '<title>LebanonTCG three strikes (vertical)</title>')

# ---- the photo ------------------------------------------------------------------------------
rep("{fan(380, 300)}", '<img class="photo" src="assets/img/fan.jpg" alt="" />')
rep("{fan(150, 210)}", '<img class="photo2" src="assets/img/fan.jpg" alt="" />')
rep("    .lcard .face svg { display: block; }",
    "    .lcard .face .photo { display: block; width: 380px; height: 300px; object-fit: cover; }\n"
    "    #acard .ph .photo2 { display: block; width: 150px; height: 210px; object-fit: cover; }")
rep("tl.to('#{cid} .face svg',", "tl.to('#{cid} .face img',")

# ---- the site panel: lower two thirds, 960 wide --------------------------------------------
rep("#site { position: absolute; left: 96px; top: 96px; width: 1060px; height: 888px;",
    "#site { position: absolute; left: 60px; top: 600px; width: 960px; height: 1130px;")
rep("#bar .nav { margin-left: auto; display: flex; gap: 26px; font-size: 18px; color: #b9c2cc; }",
    "#bar .nav { margin-left: auto; display: flex; gap: 20px; font-size: 16px; color: #b9c2cc; }")
rep("    #sell .h { position: absolute; left: 48px;", "    #sell .h { position: absolute; left: 40px;")
rep("    #sell .sub { position: absolute; left: 48px;", "    #sell .sub { position: absolute; left: 40px;")
rep("    .lcard { position: absolute; left: 48px;", "    .lcard { position: absolute; left: 40px;")
rep("    .verdict { position: absolute; left: 500px; top: 300px; width: 500px; opacity: 0; }\n    #k2-v { top: 450px; }",
    "    .verdict { position: absolute; left: 460px; top: 330px; width: 460px; opacity: 0; }")
rep("    #right { position: absolute; left: 500px; top: 150px; width: 500px; }",
    "    #right { position: absolute; left: 460px; top: 150px; width: 460px; }")
rep("    #right .note { font-size: 24px;", "    #right .note { font-size: 22px;")
rep("    .publish { position: absolute; left: 500px; top: 560px;", "    .publish { position: absolute; left: 460px; top: 560px;")
# the cooldown banner runs under the card, full width
rep("    #cool { position: absolute; left: 500px; top: 150px; width: 500px;",
    "    #cool { position: absolute; left: 40px; top: 710px; width: 880px;")
rep("    #adm .h { position: absolute; left: 48px;", "    #adm .h { position: absolute; left: 40px;")
rep("    #adm .tabs { position: absolute; left: 48px;", "    #adm .tabs { position: absolute; left: 40px;")
rep("    #acard { position: absolute; left: 48px; top: 180px; width: 964px;", "    #acard { position: absolute; left: 40px; top: 180px; width: 880px;")
rep("    #chat .head .sub { font-size: 16px;", "    #chat .head .sub { font-size: 14px;")
rep("    #chat .head .acts { margin-left: auto; display: flex; gap: 12px; }",
    "    #chat .head .acts { margin-left: auto; display: flex; gap: 10px; }\n    #chat .head .acts .btn { padding: 0 20px; font-size: 17px; }")
rep("    #susp { position: absolute; left: 36px; right: 36px; top: 20px; padding: 18px 22px; border-radius: 16px; border: 2px solid #ff5c8a; background: rgba(255, 92, 138, 0.1); font-size: 23px;",
    "    #susp { position: absolute; left: 36px; right: 36px; top: 20px; padding: 18px 22px; border-radius: 16px; border: 2px solid #ff5c8a; background: rgba(255, 92, 138, 0.1); font-size: 22px;")

# ---- strikes and captions on top, inside the title-safe box ----------------------------------
rep("    #strikes { position: absolute; left: 1240px; top: 112px;", "    #strikes { position: absolute; left: 60px; top: 176px;")
rep("    .cap { position: absolute; left: 1240px; width: 600px; opacity: 0; }", "    .cap { position: absolute; left: 60px; width: 960px; opacity: 0; }")
rep("    .cap .big { font-size: 78px;", "    .cap .big { font-size: 96px;")
rep("    .cap .mid { font-size: 60px;", "    .cap .mid { font-size: 66px;")
rep("    .cap .sm { margin-top: 26px; font-size: 30px;", "    .cap .sm { margin-top: 22px; font-size: 32px;")
rep("    #c1 { top: 330px; }", "    #c1 { top: 250px; }")
rep("    #c2 { top: 300px; }", "    #c2 { top: 240px; }")
rep("    #c3a, #c4a { top: 330px; }", "    #c3a, #c4a { top: 250px; }")
rep("    #c3b, #c4b { top: 300px; }", "    #c3b, #c4b { top: 240px; }")

# ---- the outro ------------------------------------------------------------------------------
rep("    #nojunk { position: absolute; left: 0; right: 0; top: 410px; text-align: center; font-size: 190px;",
    "    #nojunk { position: absolute; left: 0; right: 0; top: 870px; text-align: center; font-size: 170px;")
rep("    #lock { position: absolute; left: 0; right: 0; top: 300px;", "    #lock { position: absolute; left: 0; right: 0; top: 640px;")
rep("    #lock .w { font-size: 120px;", "    #lock .w { font-size: 112px;")
rep("    #tag { position: absolute; left: 0; right: 0; top: 720px; text-align: center; font-size: 30px;",
    "    #tag { position: absolute; left: 60px; right: 60px; top: 1130px; text-align: center; font-size: 30px; line-height: 1.6;")
rep("    #url { position: absolute; left: 0; right: 0; top: 790px;", "    #url { position: absolute; left: 0; right: 0; top: 1280px;")

# ---- fingertip targets: read from the vertical layout (probe-v.mjs) --------------------------
rep("TAPS = {'pub': (782, 776), 'rw': (604, 822)}", "TAPS = {'pub': (%s), 'rw': (%s)}" % (
    os.environ.get('TAP_PUB', '706, 1280'), os.environ.get('TAP_RW', '528, 1326')))

exec(compile(src, 'build_film(vertical)', 'exec'))
