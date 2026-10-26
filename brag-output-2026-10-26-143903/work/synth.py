"""LebanonTCG brag soundtrack: one piece, A minor, 120 BPM, music and SFX on one grid.

Writes work/composition/assets/audio/soundtrack.wav (stereo, 44.1 kHz, 22.5 s).
Every event time is a multiple of an eighth note (0.25 s) counted from frame 0.
"""
import numpy as np
import wave
import os

SR = 44100
DUR = 22.5
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


# ---- arrangement --------------------------------------------------------------------------
# Pad, every bar 0..9, then the final Am at 20.0
for k in range(10):
    notes, _ = CHORDS[PROG[k % 4]]
    g = 0.9 if k < 2 else (0.75 if 6 <= k < 9 else 0.65)
    place(pad_b, pad_chord(notes, BAR, attack=0.4 if k else 1.2), k * BAR, gain=g, rev=0.35)
place(pad_b, pad_chord([A3, C4, E4, A3 * 2], 1.6, attack=0.05, release=1.2), 20.0, gain=1.0, rev=0.5)

# Kick: half-time intro, a gap for the riser, four-on-the-floor from the drop
kicks = [0.0, 1.0, 2.0] + [4.0 + 0.5 * i for i in range(32)]
for k in kicks:
    g = 0.72 if 12.0 <= k < 18.0 else 0.95
    place(drums, kick(), k, gain=g)
place(drums, kick(), 20.0, gain=1.0)

# Claps on 2 and 4 in the full sections
for b in np.arange(4.0, 20.0, 0.5):
    in_full = (b < 12.0) or (b >= 18.0)
    if in_full and (b % 1.0) == 0.5:
        place(drums, clap(), b, pan=0.05, gain=0.42, rev=0.25)

# Hats: off-beat eighths from the first deal, sixteenth ghosts after the drop
for i in range(int(1.0 / 0.25), int(20.0 / 0.25)):
    s = i * 0.25
    if s % 0.5 == 0.25:
        place(drums, hat(open_=(s % 2.0 == 1.75)), s, pan=0.25, gain=0.22 if s >= 4 else 0.14)
    elif s >= 4.0 and not (12.0 <= s < 18.0):
        place(drums, hat(), s + 0.0, pan=-0.2, gain=0.07)

# Off-beat bass from the drop
for i in range(int(4.0 / 0.5), int(20.0 / 0.5)):
    s = i * 0.5 + 0.25
    _, root = chord_at(s)
    place(bass_b, bass_note(root * 2, 0.24), s, gain=0.55 if 12.0 <= s < 18.0 else 0.75)
place(bass_b, bass_note(55.0, 2.2), 20.0, gain=0.8)

# Pluck arpeggio on eighths: drop to the chat, and back in for Pre-Grade
PAT = [0, 1, 2, 1, 0, 2, 1, 2]
for i, s in enumerate(np.arange(4.0, 20.0, 0.25)):
    if 12.0 <= s < 15.0:
        continue
    if s % 0.5 != 0 and s < 18.0:
        continue
    notes, _ = chord_at(s)
    f = notes[PAT[i % 8]] * 2
    place(pluck_b, pluck(f, 0.4), s, pan=0.3 * (1 if i % 2 else -1), gain=0.32, rev=0.3)

# Riser into the drop, crash on the drop and on the logo
place(sfx_b, riser(1.0), 3.0, gain=0.35, rev=0.2)
place(drums, crash(), 4.0, gain=0.35, rev=0.2)
place(drums, crash(2.4), 20.0, gain=0.3, rev=0.3)

# ---- sound effects, tuned to the bar they land in -------------------------------------------
for s in (1.0, 1.5, 2.0, 2.5):                      # cards dealt into the fan
    place(sfx_b, flick(), s, pan=(-0.4 if s in (1.0, 2.0) else 0.4), gain=0.5, rev=0.15)
place(sfx_b, pluck(880.0, 0.6) + pluck(1318.5, 0.6), 3.0, gain=0.25, rev=0.4)  # hero card lifts (Am)
place(sfx_b, boom(), 4.0, gain=0.7)                                            # WE CONNECT
place(sfx_b, sum(pluck(f * 4, 0.5) for f in (A3, C4, E4)), 4.5, gain=0.18, rev=0.4)  # COLLECTORS
place(sfx_b, blip(1318.5), 9.0, gain=0.22, rev=0.15)                          # bid $280 (Am: E6)
place(sfx_b, blip(1760.0), 9.5, gain=0.22, rev=0.15)                          # bid $300 (Am: A6)
place(sfx_b, glide(1046.5, 1396.9, 0.18), 10.0, gain=0.25, rev=0.25)         # clock +60s (F: C6→F6)
place(sfx_b, boom(), 12.0, gain=0.45)                                          # WON AT $300
place(sfx_b, sum(pluck(f * 2, 0.6) for f in (C4, E4, G4)), 12.0, gain=0.2, rev=0.4)
place(sfx_b, glide(784.0, 523.25), 12.5, gain=0.3, rev=0.2)                   # message in (C: G5→C5)
place(sfx_b, glide(659.25, 523.25), 13.5, gain=0.3, rev=0.2)                  # reply (C: E5→C5)
place(sfx_b, sum(pluck(f * 2, 0.6) for f in (G3, B3, D4)), 14.5, gain=0.24, rev=0.35)  # offer card (G)
for s, f in ((18.5, 880.0), (18.75, 1046.5), (19.0, 1396.9), (19.25, 1760.0)):  # Pre-Grade slots (F)
    place(sfx_b, pluck(f, 0.35), s, pan=0.2, gain=0.2, rev=0.3)
place(sfx_b, bell(440.0) + 0.5 * bell(880.0), 20.0, gain=0.3, rev=0.5)       # the logo, the only bell

# ---- mix ----------------------------------------------------------------------------------
t = np.arange(N) / SR
duck = np.ones(N)
for k in kicks + [20.0]:
    m = t >= k
    duck[m] *= 1 - 0.45 * np.exp(-(t[m] - k) * 10)
bass_b *= duck
pad_b *= duck ** 0.6

# Reverb: convolve the send with a decaying stereo noise tail
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
# gentle bus glue, then fade the tail
mix = np.tanh(mix * 0.9)
fade = np.ones(N)
fs = int(SR * 21.7)
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
