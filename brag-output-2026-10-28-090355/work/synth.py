"""LebanonTCG "two phones" soundtrack: amapiano-flavoured, E minor, 112 BPM.

One piece: music and effects on one beat grid counted from frame 0 (beat n at n x 60/112 s),
using the same beat numbers as compositions/film.html. Helpers are the earlier brag
synthesizers'; the instruments and arrangement are new.
Writes composition/assets/audio/soundtrack.wav.
"""
import numpy as np
import wave
import os

SR = 44100
BPM = 112
B = 60 / BPM
BEATS = 46
DUR = BEATS * B
N = int(SR * DUR)
rng = np.random.default_rng(23)  # seeded: the render is reproducible

OUT = os.path.join(os.path.dirname(__file__), 'composition', 'assets', 'audio', 'soundtrack.wav')

# ---- buses ------------------------------------------------------------------------------
def bus():
    return np.zeros((2, N))

drums, bass_b, pad_b, pluck_b, sfx_b, send = bus(), bus(), bus(), bus(), bus(), bus()


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
    """Smooth band filter in the frequency domain (lo = highpass corner, hi = lowpass corner)."""
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


# ---- instruments ---------------------------------------------------------------------------
def T(n):
    return n * B


def log_drum(f, d=0.45):
    """Amapiano log drum: a pitched sine that swoops down onto the note, with a woody knock."""
    t = tt(d)
    fr = f * (1 + 0.9 * np.exp(-t * 38))
    s = np.sin(2 * np.pi * np.cumsum(fr) / SR)
    s = np.tanh(s * 2.2) * np.exp(-t * 4.2)
    knock = fft_filter(noise(d), lo=400, hi=2500) * np.exp(-t * 90) * 0.25
    return (s * 0.7 + knock) * np.minimum(1, t / 0.002)


def kick():
    t = tt(0.32)
    f = 50 + 80 * np.exp(-t * 35)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)
    return np.tanh(body * 1.4) * 0.75


def clap():
    t = tt(0.35)
    n = fft_filter(noise(0.35), lo=1000, hi=6000)
    env = np.zeros_like(t)
    for k, o in enumerate((0.0, 0.009, 0.019, 0.028)):
        env += np.where(t >= o, np.exp(-(t - o) * (220 if k < 3 else 18)), 0)
    return n * env * 0.45


def shaker(acc=False):
    d = 0.07
    t = tt(d)
    env = np.minimum(1, t / 0.012) * np.exp(-t * 55)
    return fft_filter(noise(d), lo=5000, hi=12000) * env * (0.5 if acc else 0.3)


def keys(freqs, d=0.32, vel=1.0):
    """A short, bright piano-ish stab: a few partials per note, quick decay."""
    t = tt(d + 0.3)
    s = np.zeros_like(t)
    for f in freqs:
        for h, a in ((1, 1.0), (2, 0.42), (3, 0.18), (4, 0.08)):
            s += a * np.sin(2 * np.pi * f * h * t) * np.exp(-t * (5 + 3 * h))
    env = np.minimum(1, t / 0.003) * np.where(t > d, np.exp(-(t - d) * 18), 1.0)
    return s * env * 0.16 * vel / np.sqrt(len(freqs))


def pad(freqs, d, attack=0.4):
    t = tt(d + 0.6)
    s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.004, 0.0035):
            s += np.sin(2 * np.pi * f * (1 + det) * t) + 0.3 * np.sin(4 * np.pi * f * (1 + det) * t)
    env = np.minimum(1, t / attack) * np.where(t > d, np.exp(-(t - d) * 5), 1.0)
    return fft_filter(s, hi=2400) * env * 0.06 / len(freqs)


def pop(f):
    """A message landing: a round sine bloop that falls a fourth."""
    t = tt(0.16)
    fr = f * (1.33 - 0.33 * np.minimum(1, t / 0.05))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 26) * np.minimum(1, t / 0.002) * 0.6


def lift(f0, f1, d=0.18):
    """Something leaving a phone: a quick rising sine with air."""
    t = tt(d)
    f = f0 * (f1 / f0) ** (t / d)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) * 0.35
    return s + fft_filter(noise(d), lo=3000, hi=9000) * np.sin(np.pi * t / d) * 0.06


def click():
    t = tt(0.025)
    return fft_filter(noise(0.025), lo=2000, hi=8000) * np.exp(-t * 260) * 0.6


def tick():
    t = tt(0.03)
    return np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 200) * 0.3


def chime(f):
    t = tt(1.4)
    idx = 1.8 * np.exp(-t * 3)
    return np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * f * 2.0 * t) * idx) * np.exp(-t * 2.2) * np.minimum(1, t / 0.002) * 0.45


def thump():
    t = tt(0.5)
    f = 42 + 55 * np.exp(-t * 16)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6) * 0.9


def whoosh(d):
    t = tt(d)
    x = t / d
    n = noise(d)
    lo = fft_filter(n, lo=300, hi=1800)
    hi = fft_filter(n, lo=2500, hi=10000)
    return (lo * (1 - x) + hi * x) * np.sin(np.pi * x) ** 1.5 * 0.45


def hit():
    """The hook's word hits: log drum + clap + a sub kick, together."""
    return log_drum(82.41, 0.6) * 0.9 + np.pad(clap(), (0, int(SR * 0.3))) [: int(SR * 0.6)] * 0.8 + np.pad(kick(), (0, int(SR * 0.3)))[: int(SR * 0.6)]


def crash(d=1.8):
    t = tt(d)
    return fft_filter(noise(d), lo=4000, hi=13000) * np.exp(-t * 2.6) * 0.5



# ---- harmony: Em9 – Am9 – Dmaj9 – Cmaj7, one bar (4 beats) each --------------------------------
M = lambda m: 440.0 * 2 ** ((m - 69) / 12)
CH = {
    'Em9':   ([M(52), M(55), M(59), M(62), M(66)], M(40)),   # E3 G3 B3 D4 F#4 / E2
    'Am9':   ([M(57), M(60), M(64), M(67), M(71)], M(45)),   # A3 C4 E4 G4 B4 / A2
    'Dmaj9': ([M(54), M(57), M(61), M(64)], M(38)),          # F#3 A3 C#4 E4 / D2
    'Cmaj7': ([M(55), M(59), M(60), M(64)], M(36)),          # G3 B3 C4 E4 / C2
}
PROG = ['Em9', 'Am9', 'Dmaj9', 'Cmaj7']


def ch_at(n):
    return CH[PROG[int(n // 4) % 4]]


GROOVE = (8, 35)      # full groove from beat 8 to the lime closing at 35-36
ENDN = 40             # the final chord with the logo


def in_groove(n):
    return GROOVE[0] <= n < GROOVE[1]


# ---- arrangement ------------------------------------------------------------------------------
# Pad under everything to the outro; the final Em9 rings from the logo
for bar in range(0, 9):
    notes, _ = CH[PROG[bar % 4]]
    place(pad_b, pad(notes, 4 * B, attack=0.6 if bar == 0 else 0.3), T(bar * 4), gain=0.9 if bar >= 2 else 0.7, rev=0.4)
place(pad_b, pad(CH['Em9'][0] + [M(71)], 4.2, attack=0.05), T(ENDN), gain=1.1, rev=0.5)

# Kick on every beat in the groove
for n in range(GROOVE[0], GROOVE[1]):
    place(drums, kick(), T(n), gain=0.8)
place(drums, kick(), T(36), gain=0.8)
place(drums, kick(), T(ENDN), gain=0.9)

# Claps on 2 and 4; shakers on every sixteenth with accents on the off-beats
for n in range(GROOVE[0], GROOVE[1]):
    if n % 2 == 1:
        place(drums, clap(), T(n), pan=0.05, gain=0.5, rev=0.3)
for k in range(GROOVE[0] * 4, GROOVE[1] * 4):
    n = k / 4
    place(drums, shaker(acc=(k % 4 == 2)), T(n), pan=0.35 if k % 2 else -0.15, gain=0.9)

# Log-drum bassline: the classic syncopation (1, the "a" of 2, the "and" of 3, 4.5), on the root
PAT = [0.0, 1.75, 2.5, 3.5]
for bar in range(GROOVE[0] // 4, GROOVE[1] // 4 + 1):
    _, root = ch_at(bar * 4)
    for k, o in enumerate(PAT):
        n = bar * 4 + o
        if not in_groove(n):
            continue
        f = root * (2 if k == 2 else 1)          # the "and" of 3 jumps an octave
        place(bass_b, log_drum(f), T(n), gain=0.8)

# Piano stabs on the off-beats of beats 1 and 3, voiced on the bar's chord
for bar in range(GROOVE[0] // 4, GROOVE[1] // 4 + 1):
    notes, _ = ch_at(bar * 4)
    for o in (0.5, 2.5, 3.25):
        n = bar * 4 + o
        if in_groove(n):
            place(sfx_b, keys([f * 2 for f in notes[1:]], 0.22, vel=0.8), T(n), pan=0.2, gain=0.55, rev=0.25)

# ---- effects, pitched to the chord they land on ----------------------------------------------
# hook (Em9): the three words hit, the card splits with a whoosh, the seam lands
for n in (0, 2, 4):
    place(sfx_b, hit(), T(n), gain=0.75, rev=0.2)
    place(sfx_b, keys([M(64), M(67), M(71)], 0.3), T(n), gain=0.6, rev=0.3)
place(sfx_b, whoosh(B * 1.2), T(6), gain=0.7, rev=0.2)
place(sfx_b, thump(), T(7), gain=0.5)
place(drums, crash(1.6), T(8), gain=0.22, rev=0.3)
# offer (bars 2-4: Dmaj9 / Cmaj7 / Em9 ...)
place(sfx_b, pop(M(81)) * 0.5, T(9), gain=0.35)                                 # bar opens (A5)
for n in (9.5, 10.0, 10.5):
    place(sfx_b, tick(), T(n), pan=-0.2, gain=0.8)
place(sfx_b, lift(M(69), M(81)), T(11), gain=0.5, rev=0.2)                       # sent from the top phone
place(sfx_b, pop(M(76)), T(11.5), gain=0.6, rev=0.25)                            # lands on the bottom (E5)
place(sfx_b, click(), T(13), gain=0.7)                                           # Accept
place(sfx_b, chime(M(83)) + 0.7 * chime(M(88)), T(13.5), gain=0.4, rev=0.4)      # accepted (B5 + E6)
place(sfx_b, pop(M(71)) * 0.6, T(14), gain=0.35)                                 # the pill
# number
place(sfx_b, pop(M(78)) * 0.5, T(18.5), gain=0.35)                               # bar opens (F#5)
for k, chx in enumerate('70 000 000'):
    if chx != ' ':
        place(sfx_b, tick(), T(19 + k * 0.25), pan=0.2, gain=0.75)
place(sfx_b, lift(M(67), M(79)), T(21), gain=0.5, rev=0.2)                       # shared from the bottom
place(sfx_b, pop(M(76)), T(21.5), gain=0.6, rev=0.25)                            # lands on top
place(sfx_b, click(), T(23), gain=0.7)                                           # WhatsApp
# meetup
place(sfx_b, pop(M(74)) * 0.5, T(26.5), gain=0.35)
place(sfx_b, click(), T(27), gain=0.7)                                           # Choose on the map
place(sfx_b, whoosh(B * 0.8), T(28) - B * 0.4, gain=0.35)                        # the map rises
place(sfx_b, thump(), T(30), gain=0.55)                                          # the pin drops
place(sfx_b, keys([M(59), M(64)], 0.4), T(30), gain=0.5, rev=0.3)
place(sfx_b, click(), T(31), gain=0.7)                                           # Use this spot
place(sfx_b, lift(M(71), M(83)), T(31.5), gain=0.45, rev=0.2)
place(sfx_b, pop(M(76)), T(32), gain=0.6, rev=0.25)                              # the location lands
place(sfx_b, chime(M(76)) * 0.6, T(32), gain=0.3, rev=0.4)
# outro: the lime closes, "see you at", then the logo on the final chord
place(sfx_b, whoosh(B * 0.9), T(35.1), gain=0.6, rev=0.2)
place(sfx_b, hit() * 0.8, T(36), gain=0.6, rev=0.3)
for k, m in enumerate((64, 67, 71, 74, 78)):                                     # Em9 up, under "see you at"
    place(sfx_b, keys([M(m + 12)], 0.5, vel=0.7), T(37 + k * 0.5), pan=-0.3 + 0.15 * k, gain=0.45, rev=0.45)
place(sfx_b, chime(M(76)) + 0.6 * chime(M(83)) + 0.4 * chime(M(88)), T(ENDN), gain=0.45, rev=0.5)
place(bass_b, log_drum(M(40), 1.6), T(ENDN), gain=0.7)

# ---- mix ----------------------------------------------------------------------------------
t = np.arange(N) / SR
duck = np.ones(N)
for n in list(range(GROOVE[0], GROOVE[1])) + [36, ENDN]:
    m = t >= T(n)
    duck[m] *= 1 - 0.3 * np.exp(-(t[m] - T(n)) * 12)
pad_b *= duck ** 0.7
bass_b *= duck ** 0.3

IRN = int(SR * 1.6)
ir_t = np.arange(IRN) / SR
wet = np.zeros((2, N))
size = 1 << int(np.ceil(np.log2(N + IRN)))
for c in range(2):
    ir = fft_filter(rng.standard_normal(IRN), lo=300, hi=5500) * np.exp(-ir_t * 3.4)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet[c] = np.fft.irfft(np.fft.rfft(send[c], size) * np.fft.rfft(ir, size), size)[:N]

mix = drums * 0.8 + bass_b * 0.9 + pad_b * 0.8 + pluck_b + sfx_b * 0.95 + wet * 0.25
for c in range(2):
    mix[c] = fft_filter(mix[c], lo=28)
mix = np.tanh(mix * 0.85)
fade = np.ones(N)
fs = int(SR * (DUR - 1.2))
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
