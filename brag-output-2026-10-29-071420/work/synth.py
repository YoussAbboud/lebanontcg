"""LebanonTCG "three strikes" soundtrack: a tight, dry groove in A minor at 100 BPM.

One piece, music and effects on one beat grid counted from frame 0 (beat n at n x 0.6 s), with
the same beat numbers as compositions/film.html. The helpers are the earlier brag synthesizers';
the arrangement is new: the drums count the strikes, each verdict gets a two-note "nope", the
countdown ticks, the suspension is the one big hit with the drums pulled out, and the logo
rings on the final chord.
Writes composition/assets/audio/soundtrack.wav.
"""
import numpy as np
import wave
import os

SR = 44100
BPM = 100
B = 60 / BPM
BEATS = 38
DUR = BEATS * B
N = int(SR * DUR)
rng = np.random.default_rng(31)  # seeded: the render is reproducible

OUT = os.path.join(os.path.dirname(__file__), 'composition', 'assets', 'audio', 'soundtrack.wav')


# ---- buses ------------------------------------------------------------------------------
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
    t = tt(0.3)
    f = 48 + 90 * np.exp(-t * 40)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 13)
    return np.tanh(body * 1.6) * 0.8


def snare():
    t = tt(0.22)
    n = fft_filter(noise(0.22), lo=1500, hi=7000) * np.exp(-t * 28)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 40) * 0.5
    return (n * 0.6 + tone) * 0.55


def hat(acc=False):
    d = 0.06
    t = tt(d)
    env = np.minimum(1, t / 0.004) * np.exp(-t * 70)
    return fft_filter(noise(d), lo=6000, hi=13000) * env * (0.42 if acc else 0.24)


def bass(f, d=0.34):
    """A plucked, slightly gritty bass: two detuned saws through a closing low-pass."""
    t = tt(d + 0.1)
    s = np.zeros_like(t)
    for det in (-0.003, 0.003):
        ph = (f * (1 + det) * t) % 1.0
        s += ph * 2 - 1
    env = np.minimum(1, t / 0.004) * np.where(t > d, np.exp(-(t - d) * 30), 1.0) * np.exp(-t * 2.5)
    s = fft_filter(s, hi=520) * env
    return np.tanh(s * 1.8) * 0.32


def ep(freqs, d=0.3, vel=1.0):
    """Electric-piano stab: bell-ish partials, quick decay."""
    t = tt(d + 0.4)
    s = np.zeros_like(t)
    for f in freqs:
        for h, a in ((1, 1.0), (2, 0.3), (3, 0.12), (5, 0.05)):
            s += a * np.sin(2 * np.pi * f * h * t) * np.exp(-t * (4 + 4 * h))
    env = np.minimum(1, t / 0.003) * np.where(t > d, np.exp(-(t - d) * 14), 1.0)
    return s * env * 0.15 * vel / np.sqrt(len(freqs))


def pad(freqs, d, attack=0.5):
    t = tt(d + 0.8)
    s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.004, 0.0035):
            s += np.sin(2 * np.pi * f * (1 + det) * t) + 0.25 * np.sin(4 * np.pi * f * (1 + det) * t)
    env = np.minimum(1, t / attack) * np.where(t > d, np.exp(-(t - d) * 4), 1.0)
    return fft_filter(s, hi=2200) * env * 0.055 / len(freqs)


def click():
    t = tt(0.025)
    return fft_filter(noise(0.025), lo=2000, hi=8000) * np.exp(-t * 260) * 0.6


def tick():
    t = tt(0.035)
    return np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 170) * 0.32


def pop(f):
    t = tt(0.16)
    fr = f * (1.33 - 0.33 * np.minimum(1, t / 0.05))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 26) * np.minimum(1, t / 0.002) * 0.55


def nope():
    """The verdict: two dry square-ish notes stepping down a tritone, very short."""
    out = np.zeros(int(SR * 0.4))
    for k, (f, st) in enumerate(((M(64), 0.0), (M(58), 0.13))):
        t = tt(0.16)
        s = np.sign(np.sin(2 * np.pi * f * t)) * 0.6 + np.sin(2 * np.pi * f * t) * 0.4
        s = fft_filter(s, hi=2600) * np.exp(-t * 16) * np.minimum(1, t / 0.003)
        i = int(SR * st)
        out[i:i + len(s)] += s * 0.42
    return out


def scan(d):
    """A rising scan tone with air, sweeping with the line over the photo."""
    t = tt(d)
    f = 320 * (1900 / 320) ** (t / d)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 0.7 * 0.16
    return s + fft_filter(noise(d), lo=3000, hi=9000) * np.sin(np.pi * t / d) * 0.05


def strike():
    """A strike lighting: a short metallic ping."""
    t = tt(0.5)
    s = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * (6 + k * 6)) for k, f in enumerate((1480, 2230, 3310)))
    return s * np.minimum(1, t / 0.002) * 0.22


def thump():
    t = tt(0.6)
    f = 40 + 60 * np.exp(-t * 14)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5) * 0.95


def siren_down(d=1.1):
    """The suspension: a slow sweep falling from high to low, like a shutter coming down."""
    t = tt(d)
    f = 880 * (110 / 880) ** (t / d)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - t / d) ** 1.2 * 0.3
    return fft_filter(s + 0.4 * np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * (1 - t / d) ** 2, hi=3000)


def crash(d=1.6):
    t = tt(d)
    return fft_filter(noise(d), lo=4000, hi=13000) * np.exp(-t * 2.8) * 0.45


def chime(f):
    t = tt(1.6)
    idx = 1.8 * np.exp(-t * 3)
    return np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * f * 2.0 * t) * idx) * np.exp(-t * 2.0) * np.minimum(1, t / 0.002) * 0.45


def hit():
    """A big downbeat: kick + snare + a low pluck together."""
    k = np.pad(kick(), (0, int(SR * 0.3)))[: int(SR * 0.6)]
    s = np.pad(snare(), (0, int(SR * 0.4)))[: int(SR * 0.6)]
    return k * 1.1 + s * 0.9 + bass(M(45), 0.5)[: int(SR * 0.6)] * 0.8


# ---- harmony: Am7 – Dm7 – Fmaj7 – E7, one bar (4 beats) each -----------------------------------
CH = {
    'Am7':   ([M(57), M(60), M(64), M(67)], M(33)),   # A3 C4 E4 G4 / A1
    'Dm7':   ([M(62), M(65), M(69), M(72)], M(38)),   # D4 F4 A4 C5 / D2
    'Fmaj7': ([M(53), M(57), M(60), M(64)], M(41)),   # F3 A3 C4 E4 / F2
    'E7':    ([M(52), M(56), M(59), M(62)], M(40)),   # E3 G#3 B3 D4 / E2
}
PROG = ['Am7', 'Dm7', 'Fmaj7', 'E7']


def ch_at(n):
    return CH[PROG[int(n // 4) % 4]]


SLAM = 26        # the suspension: drums out from here
BACK = 31        # "No junk.": the groove returns
ENDN = 34        # the lockup: one chord, held


def drums_on(n):
    return n < SLAM or BACK <= n < ENDN


# ---- arrangement ------------------------------------------------------------------------------
# A pad under everything, bar by bar; the final chord rings from the lockup to the end.
for bar in range(0, ENDN, 4):
    chord, _ = ch_at(bar)
    d = min(4, ENDN - bar) * B
    if bar >= SLAM - 2 and bar < BACK:
        continue
    place(pad_b, pad(chord, d), T(bar), gain=0.9, rev=0.5)
place(pad_b, pad([M(57), M(60), M(64), M(67), M(71)], DUR - T(ENDN) + 1, attack=0.08), T(ENDN), gain=1.2, rev=0.6)
# the slam's held chord: E7 with the drums gone, tense
place(pad_b, pad(CH['E7'][0], T(BACK) - T(SLAM), attack=0.05), T(SLAM) + 0.05, gain=0.8, rev=0.6)

# Kick on every beat, snare on 2 and 4, hats on the eighths with the "and" accented
for n in range(BEATS):
    if not drums_on(n):
        continue
    place(drums, kick(), T(n), gain=1.0)
    if n % 4 in (1, 3):
        place(drums, snare(), T(n), gain=1.0, rev=0.25)
    place(drums, hat(False), T(n), pan=0.25, gain=0.9)
    place(drums, hat(True), T(n + 0.5), pan=0.25, gain=0.9)

# Bass: root on the one, then a syncopated pattern on each bar (1, 1.5, 2.5, 3)
for bar in range(0, BEATS, 4):
    _, root = ch_at(bar)
    for off, d, g in ((0, 0.5, 1.0), (1.5, 0.3, 0.8), (2.5, 0.3, 0.8), (3, 0.6, 0.9)):
        n = bar + off
        if not drums_on(int(n)):
            continue
        f = root * (2 if off == 2.5 else 1)
        place(bass_b, bass(f, d), T(n), gain=g)

# EP stabs on the "and" of 2 and the "and" of 4, voiced on the bar's chord
for bar in range(0, BEATS, 4):
    chord, _ = ch_at(bar)
    for off in (1.5, 3.5):
        n = bar + off
        if not drums_on(int(n)):
            continue
        place(keys_b, ep(chord, 0.25, 0.9), T(n), pan=-0.2, gain=1.0, rev=0.4)

# ---- effects on the grid --------------------------------------------------------------------
# hook: the line hits on 1; the Publish tap on 4
place(sfx_b, hit(), T(1), gain=1.0, rev=0.3)
place(sfx_b, click(), T(4), gain=0.9)
# the check: the scan sweeps 6-8; the verdict and the first strike on 8
place(sfx_b, scan(2 * B), T(6), pan=-0.3, gain=1.0, rev=0.3)
place(sfx_b, nope(), T(8), gain=1.0, rev=0.2)
place(sfx_b, strike(), T(8) + 0.12, pan=0.45, gain=1.0, rev=0.5)
# the cooldown: the second card lands on 13.5, scans 14-15, verdict and strike 2 on 15, banner thud 16, ticks 17-21
place(sfx_b, pop(M(69)), T(13.5), gain=0.8, rev=0.3)
place(sfx_b, scan(B), T(14), pan=-0.3, gain=0.9, rev=0.3)
place(sfx_b, nope(), T(15), gain=1.0, rev=0.2)
place(sfx_b, strike(), T(15) + 0.12, pan=0.45, gain=1.0, rev=0.5)
place(sfx_b, thump(), T(16), gain=0.8)
for n in range(17, 22):
    place(sfx_b, tick(), T(n), pan=-0.2, gain=1.0)
# the suspension: the queue card lands 22.5, the tap on 24, the warning pops 25 with strike 3, the slam on 26
place(sfx_b, pop(M(64)), T(22.5), gain=0.7, rev=0.3)
place(sfx_b, click(), T(24), gain=0.9)
place(sfx_b, pop(M(71)), T(25), gain=0.9, rev=0.3)
place(sfx_b, strike(), T(25) + 0.12, pan=0.45, gain=1.1, rev=0.5)
place(sfx_b, thump(), T(SLAM), gain=1.1)
place(sfx_b, crash(), T(SLAM), gain=0.8, rev=0.5)
place(sfx_b, siren_down(), T(SLAM) + 0.02, gain=1.0, rev=0.4)
# outro: the groove returns on 31 with a hit; the logo bell on 34
place(sfx_b, hit(), T(BACK), gain=0.9, rev=0.3)
place(sfx_b, chime(M(81)), T(ENDN), pan=0.1, gain=0.9, rev=0.6)
place(sfx_b, chime(M(76)), T(ENDN) + 0.08, pan=-0.1, gain=0.6, rev=0.6)

# ---- mix ----------------------------------------------------------------------------------
t = np.arange(N) / SR
duck = np.ones(N)
for n in range(BEATS):
    if drums_on(n):
        m = t >= T(n)
        duck[m] *= 1 - 0.28 * np.exp(-(t[m] - T(n)) * 12)
pad_b *= duck ** 0.7
keys_b *= duck ** 0.4

IRN = int(SR * 1.5)
ir_t = np.arange(IRN) / SR
wet = np.zeros((2, N))
size = 1 << int(np.ceil(np.log2(N + IRN)))
for c in range(2):
    ir = fft_filter(rng.standard_normal(IRN), lo=300, hi=5500) * np.exp(-ir_t * 3.6)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet[c] = np.fft.irfft(np.fft.rfft(send[c], size) * np.fft.rfft(ir, size), size)[:N]

mix = drums * 0.85 + bass_b * 0.9 + pad_b * 0.8 + keys_b + sfx_b * 0.95 + wet * 0.22
for c in range(2):
    mix[c] = fft_filter(mix[c], lo=28)
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
