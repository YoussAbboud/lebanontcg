"""LebanonTCG "stamped" soundtrack: a heavy half-time beat in D minor at 90 BPM.

One piece, music and effects on one beat grid counted from frame 0 (beat n at n x 2/3 s), with
the same beat numbers as compositions/film.html. The helpers are the earlier brag synthesizers';
this arrangement is built around the stamps: each one is a slap and a thump with the screen
shake, the suspension is the biggest, and the whole thing drops out for the outro bell.
Writes composition/assets/audio/soundtrack.wav.
"""
import numpy as np
import wave
import os

SR = 44100
BPM = 90
B = 60 / BPM
BEATS = 34
DUR = BEATS * B
N = int(SR * DUR)
rng = np.random.default_rng(47)

OUT = os.path.join(os.path.dirname(__file__), 'composition', 'assets', 'audio', 'soundtrack.wav')


def bus():
    return np.zeros((2, N))


drums, bass_b, pad_b, keys_b, sfx_b, send = bus(), bus(), bus(), bus(), bus(), bus()


def place(b, sig, start, pan=0.0, gain=1.0, rev=0.0):
    i = int(round(start * SR))
    if i >= N:
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
    t = tt(0.45)
    f = 44 + 110 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    return np.tanh(body * 1.9) * 0.85


def snare():
    t = tt(0.3)
    n = fft_filter(noise(0.3), lo=1200, hi=7500) * np.exp(-t * 20)
    tone = np.sin(2 * np.pi * 175 * t) * np.exp(-t * 30) * 0.5
    return (n * 0.65 + tone) * 0.6


def hat(acc=False):
    d = 0.07
    t = tt(d)
    env = np.minimum(1, t / 0.003) * np.exp(-t * (50 if acc else 80))
    return fft_filter(noise(d), lo=6500, hi=14000) * env * (0.4 if acc else 0.2)


def sub(f0, f1, d):
    """An 808-style sub that slides between notes."""
    t = tt(d)
    f = f0 * (f1 / f0) ** np.minimum(1, t / (d * 0.5))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    env = np.minimum(1, t / 0.006) * np.exp(-t * 1.6) * np.where(t > d - 0.08, np.exp(-(t - d + 0.08) * 40), 1.0)
    return np.tanh(s * 1.5) * env * 0.5


def pad(freqs, d, attack=0.5):
    t = tt(d + 0.8)
    s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.005, 0.004):
            s += np.sin(2 * np.pi * f * (1 + det) * t) + 0.2 * np.sin(4 * np.pi * f * (1 + det) * t)
    env = np.minimum(1, t / attack) * np.where(t > d, np.exp(-(t - d) * 4), 1.0)
    return fft_filter(s, hi=1800) * env * 0.05 / len(freqs)


def stab(freqs, d=0.22):
    """A dark, short organ-ish stab."""
    t = tt(d + 0.3)
    s = np.zeros_like(t)
    for f in freqs:
        for h, a in ((1, 1.0), (2, 0.5), (3, 0.25), (4, 0.12)):
            s += a * np.sin(2 * np.pi * f * h * t)
    env = np.minimum(1, t / 0.004) * np.where(t > d, np.exp(-(t - d) * 20), 1.0)
    return fft_filter(s, hi=2600) * env * 0.09 / np.sqrt(len(freqs))


def key_tick():
    t = tt(0.03)
    return fft_filter(noise(0.03), lo=2500, hi=9000) * np.exp(-t * 220) * 0.4


def tick():
    t = tt(0.035)
    return np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 170) * 0.32


def stamp(size=1.0):
    """A rubber stamp hitting paper: a slap of noise with a wooden body and a low thump."""
    t = tt(0.5)
    slap = fft_filter(noise(0.5), lo=500, hi=5000) * np.exp(-t * 60)
    body = np.sin(2 * np.pi * (120 + 90 * np.exp(-t * 60)) * t) * np.exp(-t * 28)
    f = 42 + 70 * np.exp(-t * 14)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6)
    return (slap * 0.55 + body * 0.5 + thump * 0.9 * size) * np.minimum(1, t / 0.001)


def crash(d=1.6):
    t = tt(d)
    return fft_filter(noise(d), lo=4000, hi=13000) * np.exp(-t * 2.8) * 0.45


def rev_crash(d=1.2):
    t = tt(d)
    return fft_filter(noise(d), lo=2500, hi=12000) * (t / d) ** 3 * 0.4


def alarm(d=1.4):
    """The suspension: a low two-tone alarm, dry, fading."""
    t = tt(d)
    f = np.where((t * 4) % 2 < 1, M(50), M(44))
    s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.5 + np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5
    return fft_filter(s, hi=1200) * (1 - t / d) ** 1.5 * 0.22


def chime(f):
    t = tt(1.8)
    idx = 1.8 * np.exp(-t * 3)
    return np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * f * 2.0 * t) * idx) * np.exp(-t * 1.8) * np.minimum(1, t / 0.002) * 0.45


# ---- harmony: Dm – Bb – Gm – A, one bar (4 beats) each ------------------------------------------
CH = {
    'Dm': ([M(50), M(53), M(57), M(62)], (M(38), M(38))),
    'Bb': ([M(46), M(50), M(53), M(58)], (M(34), M(34))),
    'Gm': ([M(43), M(46), M(50), M(55)], (M(31), M(43))),
    'A':  ([M(45), M(49), M(52), M(57)], (M(33), M(45))),
}
PROG = ['Dm', 'Bb', 'Gm', 'A']


def ch_at(n):
    return CH[PROG[int(n // 4) % 4]]


SLAM = 22       # the suspension: drums out
OUTRO = 27      # black; the bell on the lockup at 29.5
LOCK = 29.5


def drums_on(n):
    return n < SLAM or OUTRO <= n < LOCK


# ---- arrangement ------------------------------------------------------------------------------
for bar in range(0, OUTRO, 4):
    chord, _ = ch_at(bar)
    if bar >= SLAM - 2:
        continue
    place(pad_b, pad(chord, min(4, OUTRO - bar) * B), T(bar), gain=0.9, rev=0.5)
place(pad_b, pad(CH['A'][0], T(OUTRO) - T(SLAM), attack=0.05), T(SLAM) + 0.05, gain=0.6, rev=0.6)
place(pad_b, pad([M(50), M(57), M(62), M(65)], DUR - T(LOCK) + 1, attack=0.08), T(LOCK), gain=1.2, rev=0.6)

# Half-time: kick on 1 and the "and" of 2, snare on 3; hats on eighths, accents on the off-beats
for bar in range(0, BEATS, 4):
    for off, g in ((0, 1.0), (1.5, 0.8), (2, 0), (3.75, 0.6)):
        n = bar + off
        if not drums_on(int(n)) or n >= BEATS:
            continue
        if g:
            place(drums, kick(), T(n), gain=g)
    n = bar + 2
    if drums_on(int(n)) and n < BEATS:
        place(drums, snare(), T(n), gain=1.0, rev=0.3)
    for k in range(8):
        n = bar + k * 0.5
        if not drums_on(int(n)) or n >= BEATS:
            continue
        place(drums, hat(k % 2 == 1), T(n), pan=0.3, gain=0.9)

# Sub bass: the root on the one, a slide up to the fifth on the "and" of 3
for bar in range(0, BEATS, 4):
    _, (r, s2) = ch_at(bar)
    if drums_on(bar):
        place(bass_b, sub(r, r, 1.4 * B), T(bar), gain=1.0)
    n = bar + 2.5
    if drums_on(int(n)) and n < BEATS:
        place(bass_b, sub(r, s2, 1.2 * B), T(n), gain=0.85)

# Stabs on the "and" of 1 and the 4, dark and short
for bar in range(0, BEATS, 4):
    chord, _ = ch_at(bar)
    for off in (0.5, 3):
        n = bar + off
        if drums_on(int(n)) and n < BEATS:
            place(keys_b, stab(chord), T(n), pan=-0.15, gain=1.0, rev=0.45)

# ---- effects on the grid --------------------------------------------------------------------
# the headline hits on 1; the title types on 0.5-1.5 (ticks on the eighths)
place(sfx_b, stamp(0.6), T(1), gain=0.8, rev=0.3)
for k in range(5):
    place(sfx_b, key_tick(), T(0.5 + k * 0.25), pan=-0.3, gain=0.8)
# strike 1: the stamp on 4, the photo greys on 6
place(sfx_b, rev_crash(0.9), T(4) - 0.9, gain=0.6, rev=0.3)
place(sfx_b, stamp(1.0), T(4), gain=1.1, rev=0.35)
place(sfx_b, crash(1.2), T(4), gain=0.45, rev=0.4)
place(sfx_b, tick(), T(6), gain=0.8)
# strike 2: the second title types 11-12, the stamp on 13, the cooldown on 15, the seconds tick 16-20
for k in range(5):
    place(sfx_b, key_tick(), T(11 + k * 0.25), pan=-0.3, gain=0.8)
place(sfx_b, stamp(1.0), T(13), gain=1.1, rev=0.35)
place(sfx_b, rev_crash(0.9), T(15) - 0.9, gain=0.6, rev=0.3)
place(sfx_b, stamp(1.2), T(15), gain=1.15, rev=0.35)
for n in range(16, 19):
    place(sfx_b, tick(), T(n), pan=-0.2, gain=1.0)
# strike 3: the log lines on 19, 20, 21; the slam on 22
for n in (19, 20, 21):
    place(sfx_b, key_tick(), T(n), pan=0.2, gain=1.0)
    place(sfx_b, tick(), T(n) + 0.02, pan=0.2, gain=0.6)
place(sfx_b, rev_crash(1.2), T(SLAM) - 1.2, gain=0.8, rev=0.3)
place(sfx_b, stamp(1.6), T(SLAM), gain=1.3, rev=0.4)
place(sfx_b, crash(1.8), T(SLAM), gain=0.7, rev=0.5)
place(sfx_b, alarm(), T(SLAM) + 0.1, gain=1.0, rev=0.3)
# outro: a hit for "No junk." on 27, the bell on the lockup at 30
place(sfx_b, stamp(1.0), T(OUTRO), gain=1.0, rev=0.3)
place(sfx_b, chime(M(74)), T(LOCK), pan=0.1, gain=0.9, rev=0.6)
place(sfx_b, chime(M(69)), T(LOCK) + 0.08, pan=-0.1, gain=0.6, rev=0.6)

# ---- mix ----------------------------------------------------------------------------------
t = np.arange(N) / SR
duck = np.ones(N)
for bar in range(0, BEATS, 4):
    for off in (0, 1.5, 2, 3.75):
        n = bar + off
        if drums_on(int(n)) and n < BEATS:
            m = t >= T(n)
            duck[m] *= 1 - 0.32 * np.exp(-(t[m] - T(n)) * 10)
pad_b *= duck ** 0.7
keys_b *= duck ** 0.4
bass_b *= duck ** 0.25

IRN = int(SR * 1.6)
ir_t = np.arange(IRN) / SR
wet = np.zeros((2, N))
size = 1 << int(np.ceil(np.log2(N + IRN)))
for c in range(2):
    ir = fft_filter(rng.standard_normal(IRN), lo=300, hi=5000) * np.exp(-ir_t * 3.2)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet[c] = np.fft.irfft(np.fft.rfft(send[c], size) * np.fft.rfft(ir, size), size)[:N]

mix = drums * 0.85 + bass_b * 0.95 + pad_b * 0.8 + keys_b + sfx_b * 0.95 + wet * 0.22
for c in range(2):
    mix[c] = fft_filter(mix[c], lo=26)
mix = np.tanh(mix * 0.85)
fade = np.ones(N)
fs = int(SR * (DUR - 1.0))
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
