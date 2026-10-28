"""LebanonTCG chat brag soundtrack: one piece, A minor, 120 BPM, music and SFX on one grid.

Writes work/composition/assets/audio/soundtrack.wav (stereo, 44.1 kHz, 21 s).
Every event time is a multiple of a sixteenth (0.125 s) counted from frame 0; scene seams
are on beats (4.0, 9.0, 13.0, 18.0). Instruments and mix are the square cut's (2026-10-26).
"""
import numpy as np
import wave
import os

SR = 44100
DUR = 21.0
N = int(SR * DUR)
rng = np.random.default_rng(7)  # seeded: the render is reproducible

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


# ---- instruments --------------------------------------------------------------------------
def kick():
    t = tt(0.42)
    f = 46 + 95 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 8.5)
    click = fft_filter(noise(0.42), lo=1500, hi=6000) * np.exp(-t * 350) * 0.12
    return np.tanh((body + click) * 1.6) * 0.8


def clap():
    t = tt(0.3)
    n = fft_filter(noise(0.3), lo=900, hi=5000)
    env = np.zeros_like(t)
    for k, o in enumerate((0.0, 0.011, 0.022)):
        env += np.where(t >= o, np.exp(-(t - o) * (180 if k < 2 else 22)), 0)
    return n * env * 0.5


def hat(open_=False):
    d = 0.18 if open_ else 0.06
    t = tt(d)
    return fft_filter(noise(d), lo=7000, hi=14000) * np.exp(-t * (18 if open_ else 70)) * 0.6


def bass_note(f, d):
    t = tt(d)
    env = np.minimum(1, t / 0.006) * np.exp(-t * 5)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)
    return np.tanh(s * 1.4) * env * 0.7


def saw(f, t):
    return 2 * ((f * t) % 1.0) - 1


def pad_chord(freqs, d, attack=0.35, release=0.5):
    t = tt(d + release)
    s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.0045, 0.0, 0.0052):
            s += saw(f * (1 + det), t + rng.random())
    s = fft_filter(s, lo=120, hi=1300)
    env = np.minimum(1, t / attack) * np.where(t > d, np.exp(-(t - d) * 6), 1.0)
    return s * env / (len(freqs) * 3)


def pluck(f, d=0.45, bright=1.0):
    """Karplus-Strong pluck."""
    n = int(SR * d)
    p = max(2, int(SR / f))
    buf = rng.uniform(-1, 1, p)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * (0.996 if bright >= 1 else 0.99)
    t = tt(d)
    return out * np.exp(-t * 3)


def riser(d):
    t = tt(d)
    n = noise(d)
    # brighten over time by mixing a highpassed copy in
    hp = fft_filter(n, lo=3000, hi=12000)
    lp = fft_filter(n, lo=200, hi=1500)
    x = t / d
    s = lp * (1 - x) + hp * x
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (x * 2)) / SR) * 0.15
    return (s * 0.5 + tone) * x ** 2


def crash(d=1.8):
    t = tt(d)
    return fft_filter(noise(d), lo=4000, hi=13000) * np.exp(-t * 2.6) * 0.5


def boom():
    t = tt(1.2)
    f = 38 + 70 * np.exp(-t * 9)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    s += fft_filter(noise(1.2), lo=60, hi=900) * np.exp(-t * 10) * 0.25
    return np.tanh(s * 1.3)


def flick():
    """A card dealt onto felt: short, soft, filtered."""
    t = tt(0.09)
    n = fft_filter(noise(0.09), lo=1200, hi=5200)
    return n * np.exp(-t * 70) * 0.55


def blip(f, d=0.09):
    t = tt(d)
    return np.sin(2 * np.pi * f * t) * np.exp(-t * 45) * np.minimum(1, t / 0.002)


def glide(f0, f1, d=0.14):
    t = tt(d)
    f = f0 * (f1 / f0) ** (t / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 18) * np.minimum(1, t / 0.003)


def bell(f, d=3.2):
    t = tt(d)
    idx = 2.4 * np.exp(-t * 2.5)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * idx
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 1.4) * np.minimum(1, t / 0.003)


# ---- harmony ------------------------------------------------------------------------------
A2, A3, C4, E4, F3, G3, B3, D4, G4 = 110.0, 220.0, 261.63, 329.63, 174.61, 196.0, 246.94, 293.66, 392.0
CHORDS = {
    'Am': ([A3, C4, E4], 55.0),
    'F': ([F3, A3, C4], 43.65),
    'C': ([C4, E4, G4], 65.41),
    'G': ([G3, B3, D4], 49.0),
}
PROG = ['Am', 'F', 'C', 'G']
BAR = 2.0


def chord_at(t):
    return CHORDS[PROG[int(t // BAR) % 4]]


# ---- extra voices ---------------------------------------------------------------------------
def tick():
    """A key press: tiny, dry, high."""
    t = tt(0.03)
    return fft_filter(noise(0.03), lo=2500, hi=9000) * np.exp(-t * 220) * 0.5


def swish(d=0.25):
    """Air moving into a seam: filtered noise that swells and stops on the cut."""
    t = tt(d)
    x = t / d
    return fft_filter(noise(d), lo=900, hi=7000) * x ** 2 * 0.35


# ---- arrangement --------------------------------------------------------------------------
END = 18.0  # the outro's final chord
# Pad every bar to the outro, then the final Am
for k in range(9):
    notes, _ = CHORDS[PROG[k % 4]]
    g = 0.9 if k < 2 else (0.75 if 4 <= k < 6 else 0.65)
    place(pad_b, pad_chord(notes, BAR, attack=0.4 if k else 1.0), k * BAR, gain=g, rev=0.35)
place(pad_b, pad_chord([A3, C4, E4, A3 * 2], 2.0, attack=0.05, release=1.2), END, gain=1.0, rev=0.5)

def calm(s):  # the phone scene pulls the drums back so the typing reads
    return 9.0 <= s < 13.0

# Kick: half-time intro, a gap for the riser, four-on-the-floor from the drop
kicks = [0.0, 1.0, 2.0] + [4.0 + 0.5 * i for i in range(int((END - 4.0) / 0.5))]
for k in kicks:
    place(drums, kick(), k, gain=0.72 if calm(k) else 0.95)
place(drums, kick(), END, gain=1.0)

# Claps on 2 and 4 in the full sections
for b in np.arange(4.0, END, 0.5):
    if not calm(b) and (b % 1.0) == 0.5:
        place(drums, clap(), b, pan=0.05, gain=0.42, rev=0.25)

# Hats: off-beat eighths from the first word, sixteenth ghosts after the drop
for i in range(int(0.5 / 0.25), int(END / 0.25)):
    s = i * 0.25
    if s % 0.5 == 0.25:
        place(drums, hat(open_=(s % 2.0 == 1.75)), s, pan=0.25, gain=0.22 if s >= 4 else 0.14)
    elif s >= 4.0 and not calm(s):
        place(drums, hat(), s, pan=-0.2, gain=0.07)

# Off-beat bass from the drop
for i in range(int(4.0 / 0.5), int(END / 0.5)):
    s = i * 0.5 + 0.25
    _, root = chord_at(s)
    place(bass_b, bass_note(root * 2, 0.24), s, gain=0.55 if calm(s) else 0.75)
place(bass_b, bass_note(55.0, 2.2), END, gain=0.8)

# Pluck arpeggio on eighths from the drop; quarter notes only under the typing
PAT = [0, 1, 2, 1, 0, 2, 1, 2]
for i, s in enumerate(np.arange(4.0, END, 0.25)):
    if s % 0.5 != 0 and (calm(s) or s < 6.0):
        continue
    notes, _ = chord_at(s)
    place(pluck_b, pluck(notes[PAT[i % 8]] * 2, 0.4), s, pan=0.3 * (1 if i % 2 else -1), gain=0.3, rev=0.3)

# Riser into the drop, crashes on the drop and the outro, air into each seam
place(sfx_b, riser(1.0), 3.0, gain=0.35, rev=0.2)
place(drums, crash(), 4.0, gain=0.35, rev=0.2)
place(drums, crash(2.4), END, gain=0.3, rev=0.3)
for seam in (9.0, 13.0):
    place(sfx_b, swish(0.25), seam - 0.25, gain=0.6, rev=0.1)

# ---- sound effects, tuned to the chord they land in -----------------------------------------
# 1 · hook: OFFER / NUMBER / MEETUP light up on A, C, E (Am), the line on the full chord
for s, f in ((0.5, 880.0), (1.0, 1046.5), (1.5, 1318.5)):
    place(sfx_b, pluck(f, 0.5), s, pan=(-0.3, 0.0, 0.3)[int((s - 0.5) * 2)], gain=0.3, rev=0.35)
    place(sfx_b, boom() * 0.35, s, gain=0.35)
place(sfx_b, sum(pluck(f * 2, 0.6) for f in (A3, C4, E4)), 2.0, gain=0.2, rev=0.4)
# 2 · offer (bar 3 = C, bar 4 = G)
place(sfx_b, boom(), 4.0, gain=0.6)                                        # the drop into the chat
place(sfx_b, glide(523.25, 784.0, 0.16), 4.5, gain=0.18, rev=0.2)          # $ opens the bar (C5→G5)
for s in (4.75, 5.0, 5.25):                                                # "2", "9", "0"
    place(sfx_b, tick(), s, pan=0.2, gain=0.5)
place(sfx_b, sum(pluck(f * 2, 0.6) for f in (C4, E4, G4)), 5.5, gain=0.26, rev=0.35)   # offer lands (C)
place(sfx_b, blip(1568.0) + 0.6 * blip(2349.3), 7.0, gain=0.2, rev=0.3)    # accepted (G: G6 + D7)
place(sfx_b, blip(1174.7), 7.25, gain=0.12, rev=0.3)                      # system pill (G: D6)
# 3 · number (bar 5 = C, bar 6 = F)
for k, ch in enumerate('70 000 000'):
    if ch != ' ':
        place(sfx_b, tick(), 9.5 + k * 0.125, pan=0.15, gain=0.45)
place(sfx_b, sum(pluck(f * 2, 0.6) for f in (F3, A3, C4)), 11.0, gain=0.28, rev=0.35)  # card lands (F)
# 4 · meetup (bar 7 = G, bar 8 = Am)
place(sfx_b, blip(1568.0), 13.5, gain=0.16, rev=0.2)                       # tap "Choose on the map" (G6)
place(sfx_b, glide(392.0, 784.0, 0.22), 14.0, gain=0.18, rev=0.3)          # the picker rises (G4→G5)
place(sfx_b, boom() * 0.6, 15.0, gain=0.4)                                 # the pin drops onto the spot
place(sfx_b, pluck(783.99, 0.5), 15.0, gain=0.22, rev=0.35)
place(sfx_b, blip(1975.5), 15.5, gain=0.14, rev=0.2)                       # Use this spot (G: B6)
place(sfx_b, sum(pluck(f * 2, 0.6) for f in (A3, C4, E4)), 16.0, gain=0.28, rev=0.35)  # card lands (Am)
# 5 · outro: the final chord at 18.0, the only bell with the lockup at 18.5
place(sfx_b, bell(440.0) + 0.5 * bell(880.0), 18.5, gain=0.3, rev=0.5)

# ---- mix ----------------------------------------------------------------------------------
t = np.arange(N) / SR
duck = np.ones(N)
for k in kicks + [END]:
    m = t >= k
    duck[m] *= 1 - 0.45 * np.exp(-(t[m] - k) * 10)
bass_b *= duck
pad_b *= duck ** 0.6

IRN = int(SR * 1.8)
ir_t = np.arange(IRN) / SR
wet = np.zeros((2, N))
size = 1 << int(np.ceil(np.log2(N + IRN)))
for c in range(2):
    ir = fft_filter(rng.standard_normal(IRN), lo=250, hi=5000) * np.exp(-ir_t * 3.2)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet[c] = np.fft.irfft(np.fft.rfft(send[c], size) * np.fft.rfft(ir, size), size)[:N]

mix = drums * 0.8 + bass_b * 0.85 + pad_b * 0.75 + pluck_b * 0.8 + sfx_b * 0.95 + wet * 0.24
for c in range(2):
    mix[c] = fft_filter(mix[c], lo=28)
mix = np.tanh(mix * 0.9)
fade = np.ones(N)
fs = int(SR * 20.2)
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
print('wrote', OUT, round(N / SR, 2), 's')
