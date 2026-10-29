"""LebanonTCG "on your home screen" soundtrack: a bright pop groove in A minor / C major at 112 BPM.

Music and effects on one beat grid counted from frame 0 (beat n at n x 60/112 s), with the same beat
numbers as compositions/film.html. The instruments are the earlier LebanonTCG brag synthesizers';
this arrangement is four-on-the-floor with a clap on 2 and 4, a plucky bass and chord stabs. The
hook lines slam before the groove starts (beat 4); the drums stop for the lockup (beat 28).
Writes composition/assets/audio/soundtrack.wav.
"""
import numpy as np
import wave
import os

SR = 44100
BPM = 112
B = 60 / BPM
BEATS = 34
DUR = BEATS * B
N = int(SR * DUR)
rng = np.random.default_rng(23)

OUT = os.path.join(os.path.dirname(__file__), 'composition', 'assets', 'audio', 'soundtrack.wav')


def bus():
    return np.zeros((2, N))


drums, bass_b, pad_b, keys_b, sfx_b, send = bus(), bus(), bus(), bus(), bus(), bus()


def place(b, sig, start, pan=0.0, gain=1.0, rev=0.0):
    i = int(round(start * SR))
    if i >= N or i < 0:
        return
    s = sig[: N - i] * gain
    l = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
    r = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
    b[0, i:i + len(s)] += s * l
    b[1, i:i + len(s)] += s * r
    if rev:
        send[0, i:i + len(s)] += s * l * rev
        send[1, i:i + len(s)] += s * r * rev


def tt(d):
    return np.arange(int(SR * d)) / SR


def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-6)) ** 4)
    return np.fft.irfft(X * g, len(x))


def noise(d):
    return rng.standard_normal(int(SR * d))


def T(n):
    return n * B


M = lambda m: 440.0 * 2 ** ((m - 69) / 12)


# ---- instruments ---------------------------------------------------------------------------
def kick():
    t = tt(0.4)
    f = 48 + 120 * np.exp(-t * 38)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)
    click = fft_filter(noise(0.4), lo=1500, hi=6000) * np.exp(-t * 300) * 0.5
    return np.tanh((body + click) * 1.8) * 0.8


def clap():
    t = tt(0.28)
    n = fft_filter(noise(0.28), lo=900, hi=6500)
    env = np.zeros_like(t)
    for k, g in ((0, 0.6), (0.011, 0.8), (0.022, 1.0)):
        env += g * np.exp(-np.maximum(t - k, 0) * 55) * (t >= k)
    return n * env * 0.5


def hat(open_=False):
    d = 0.16 if open_ else 0.06
    t = tt(d)
    env = np.minimum(1, t / 0.002) * np.exp(-t * (22 if open_ else 90))
    return fft_filter(noise(d), lo=7000, hi=15000) * env * (0.3 if open_ else 0.2)


def pluck(f, d):
    """A plucky bass: a short saw with a closing filter."""
    t = tt(d + 0.1)
    s = np.zeros_like(t)
    for h, a in ((1, 1.0), (2, 0.5), (3, 0.33), (4, 0.25), (5, 0.2)):
        s += a * np.sin(2 * np.pi * f * h * t)
    env = np.minimum(1, t / 0.004) * np.exp(-t * 7) * np.where(t > d, np.exp(-(t - d) * 40), 1.0)
    return fft_filter(s, hi=900) * env * 0.33


def pad(freqs, d, attack=0.5):
    t = tt(d + 0.8)
    s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.004, 0.004):
            s += np.sin(2 * np.pi * f * (1 + det) * t) + 0.25 * np.sin(4 * np.pi * f * (1 + det) * t)
    env = np.minimum(1, t / attack) * np.where(t > d, np.exp(-(t - d) * 4), 1.0)
    return fft_filter(s, hi=2200) * env * 0.05 / len(freqs)


def stab(freqs, d=0.2):
    """A bright, short chord stab."""
    t = tt(d + 0.3)
    s = np.zeros_like(t)
    for f in freqs:
        for h, a in ((1, 1.0), (2, 0.45), (3, 0.2)):
            s += a * np.sin(2 * np.pi * f * h * t)
    env = np.minimum(1, t / 0.003) * np.where(t > d, np.exp(-(t - d) * 24), 1.0)
    return fft_filter(s, hi=4200) * env * 0.09 / np.sqrt(len(freqs))


def key_tick():
    t = tt(0.03)
    return fft_filter(noise(0.03), lo=2500, hi=9000) * np.exp(-t * 220) * 0.4


def click():
    t = tt(0.05)
    return (fft_filter(noise(0.05), lo=1800, hi=7000) * np.exp(-t * 160) * 0.5 + np.sin(2 * np.pi * 1400 * t) * np.exp(-t * 140) * 0.25)


def pop(size=1.0):
    """A soft pop: a sine body dropping an octave."""
    t = tt(0.16)
    f = 320 * np.exp(-t * 18) + 140
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 26) * np.minimum(1, t / 0.001) * 0.5 * size


def thump(size=1.0):
    t = tt(0.45)
    slap = fft_filter(noise(0.45), lo=400, hi=4000) * np.exp(-t * 70)
    f = 50 + 80 * np.exp(-t * 16)
    low = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    return (slap * 0.45 + low * 0.9 * size) * np.minimum(1, t / 0.001)


def whoosh(d=0.5, rising=True):
    t = tt(d)
    env = (t / d) ** 2.2 if rising else (1 - t / d) ** 2.2
    return fft_filter(noise(d), lo=800, hi=9000) * env * 0.35


def riser(d=1.4):
    t = tt(d)
    return fft_filter(noise(d), lo=2000, hi=12000) * (t / d) ** 3 * 0.45


def chime(f, d=1.8):
    t = tt(d)
    idx = 1.8 * np.exp(-t * 3)
    return np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * f * 2.0 * t) * idx) * np.exp(-t * 1.8) * np.minimum(1, t / 0.002) * 0.45


def sparkle():
    t = tt(0.5)
    s = sum(np.sin(2 * np.pi * M(m) * t) * np.exp(-t * (9 + k * 3)) for k, m in enumerate((88, 92, 95, 100)))
    return s * np.minimum(1, t / 0.002) * 0.09


# ---- harmony: Am – F – C – G, one bar (4 beats) each ------------------------------------------
CH = {
    'Am': ([M(57), M(60), M(64), M(69)], M(33)),
    'F':  ([M(53), M(57), M(60), M(65)], M(41)),
    'C':  ([M(48), M(55), M(60), M(64)], M(36)),
    'G':  ([M(55), M(59), M(62), M(67)], M(43)),
}
PROG = ['Am', 'F', 'C', 'G']


def ch_at(n):
    return CH[PROG[int(n // 4) % 4]]


GROOVE = 4      # the phone lands: the full groove starts
OUTRO = 27      # the cover: drums out, one chord
LOCK = 28       # the lockup: the bell


def drums_on(n):
    return GROOVE <= n < OUTRO


# ---- arrangement ------------------------------------------------------------------------------
for bar in range(0, OUTRO, 4):
    chord, _ = ch_at(bar)
    if bar < GROOVE:
        continue
    place(pad_b, pad(chord, min(4, OUTRO - bar) * B), T(bar), gain=0.9, rev=0.5)
place(pad_b, pad([M(45), M(57), M(60), M(64), M(69)], DUR - T(LOCK) + 1, attack=0.08), T(LOCK), gain=1.3, rev=0.6)

# Four on the floor, clap on 2 and 4, eighth hats (open on the off-beats before a bar)
for bar in range(0, BEATS, 4):
    for off in (0, 1, 2, 3):
        n = bar + off
        if drums_on(n):
            place(drums, kick(), T(n), gain=1.0)
        if drums_on(n) and off in (1, 3):
            place(drums, clap(), T(n), gain=0.9, rev=0.35)
    for k in range(8):
        n = bar + k * 0.5
        if not drums_on(int(n)):
            continue
        place(drums, hat(k == 7), T(n), pan=0.3, gain=0.9)

# Bass: root on 1, 2.5 and 3.5; the octave on 3
for bar in range(0, BEATS, 4):
    _, root = ch_at(bar)
    for off, f, d in ((0, root, 0.9), (1, root, 0.4), (2.5, root, 0.4), (3, root * 2, 0.35), (3.5, root, 0.4)):
        n = bar + off
        if drums_on(int(n)):
            place(bass_b, pluck(f, d * B), T(n), gain=1.0)

# Stabs on the "and" of 1 and on 2.5, bright and short
for bar in range(0, BEATS, 4):
    chord, _ = ch_at(bar)
    for off in (0.5, 2.5):
        n = bar + off
        if drums_on(int(n)):
            place(keys_b, stab(chord), T(n), pan=-0.15, gain=1.0, rev=0.45)

# ---- effects on the grid --------------------------------------------------------------------
# the hook: two slams (1, 2), a riser into the phone (4) and a thump as it lands
place(sfx_b, thump(1.1), T(1), gain=1.2, rev=0.3)
place(sfx_b, kick(), T(1), gain=0.8)
place(sfx_b, thump(1.1), T(2), gain=1.2, rev=0.3)
place(sfx_b, kick(), T(2), gain=0.8)
place(sfx_b, riser(1.3), T(4) - 1.3, gain=0.7, rev=0.3)
place(sfx_b, thump(1.3), T(4), gain=1.2, rev=0.35)
# the sheet slides up into 6
place(sfx_b, whoosh(0.42, rising=True), T(6) - 0.42, gain=0.8, rev=0.2)
place(sfx_b, pop(0.6), T(6), gain=0.6)
# the three cards pop out (9, 10, 11)
for k, n in enumerate((9, 10, 11)):
    place(sfx_b, pop(1.0), T(n), pan=-0.2 + 0.2 * k, gain=1.0 - 0.1 * k, rev=0.25)
    place(sfx_b, key_tick(), T(n), gain=0.6)
# the cards drop (14), the button slides in (14.5), the tap (15.5)
place(sfx_b, whoosh(0.35, rising=False), T(14), gain=0.7)
place(sfx_b, whoosh(0.3, rising=True), T(14.5) - 0.3, gain=0.6)
place(sfx_b, click(), T(15.5), gain=1.1)
# the icon flies (17 → 19): a whoosh, then a thump and a sparkle on the landing
place(sfx_b, whoosh(0.9, rising=True), T(17), gain=0.7, rev=0.3)
place(sfx_b, thump(0.8), T(19), gain=0.9, rev=0.3)
place(sfx_b, sparkle(), T(19) + 0.05, gain=1.0, rev=0.5)
# the tap (21) and the window opening (21.2 → 23)
place(sfx_b, click(), T(21), gain=1.1)
place(sfx_b, whoosh(0.8, rising=True), T(21.2), gain=0.7, rev=0.3)
place(sfx_b, pop(0.5), T(23), gain=0.5)
# the cover (27) and the bell on the lockup (28)
place(sfx_b, thump(1.0), T(OUTRO), gain=1.0, rev=0.3)
place(sfx_b, chime(M(76)), T(LOCK), pan=0.1, gain=0.9, rev=0.6)
place(sfx_b, chime(M(69)), T(LOCK) + 0.08, pan=-0.1, gain=0.6, rev=0.6)
place(sfx_b, sparkle(), T(LOCK) + 0.1, gain=0.8, rev=0.5)

# ---- mix ----------------------------------------------------------------------------------
t = np.arange(N) / SR
duck = np.ones(N)
for bar in range(0, BEATS, 4):
    for off in (0, 1, 2, 3):
        n = bar + off
        if drums_on(n):
            m = t >= T(n)
            duck[m] *= 1 - 0.3 * np.exp(-(t[m] - T(n)) * 10)
pad_b *= duck ** 0.7
keys_b *= duck ** 0.4
bass_b *= duck ** 0.25

IRN = int(SR * 1.4)
ir_t = np.arange(IRN) / SR
wet = np.zeros((2, N))
size = 1 << int(np.ceil(np.log2(N + IRN)))
for c in range(2):
    ir = fft_filter(rng.standard_normal(IRN), lo=300, hi=6000) * np.exp(-ir_t * 3.4)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet[c] = np.fft.irfft(np.fft.rfft(send[c], size) * np.fft.rfft(ir, size), size)[:N]

mix = drums * 0.85 + bass_b * 0.95 + pad_b * 0.8 + keys_b + sfx_b * 0.95 + wet * 0.22
for c in range(2):
    mix[c] = fft_filter(mix[c], lo=26)
mix = np.tanh(mix * 0.85)
fade = np.ones(N)
fs = int(SR * (DUR - 0.8))
fade[fs:] = np.linspace(1, 0, N - fs) ** 1.5
mix *= fade
mix *= 0.89 / np.max(np.abs(mix))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
pcm = (mix.T * 32767).astype('<i2')
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', OUT, round(N / SR, 3), 's')
