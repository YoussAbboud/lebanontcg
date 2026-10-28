"""LebanonTCG chat brag — alternate soundtrack: lo-fi neo-soul, D minor, 120 BPM half-time.

Same 21 s timeline and event times as the house version (work/synth.py in
brag-output-2026-10-28-082930), so the existing renders take it as-is: scene seams on
beats (4.0, 9.0, 13.0, 18.0), every effect on the 0.125 s grid, pitched to its chord.
Writes work/soundtrack-lofi.wav.
"""
import numpy as np
import wave
import os

SR = 44100
DUR = 21.0
N = int(SR * DUR)
rng = np.random.default_rng(11)  # seeded: the render is reproducible

OUT = os.path.join(os.path.dirname(__file__), 'soundtrack-lofi.wav')

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


def swish(d=0.25):
    """Air moving into a seam: filtered noise that swells and stops on the cut."""
    t = tt(d)
    x = t / d
    return fft_filter(noise(d), lo=900, hi=7000) * x ** 2 * 0.35


# ---- lo-fi voices ---------------------------------------------------------------------------
def rhodes(f, d, vel=1.0):
    """Electric piano: two-operator FM with a decaying index, soft tine, slow tremolo."""
    t = tt(d + 0.8)
    idx = 1.6 * vel * np.exp(-t * 6) + 0.25
    mod = np.sin(2 * np.pi * f * t) * idx
    s = np.sin(2 * np.pi * f * t + mod)
    s += 0.18 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t * 18)          # tine
    env = np.minimum(1, t / 0.004) * np.exp(-t * 1.1) * np.where(t > d, np.exp(-(t - d) * 7), 1.0)
    trem = 1 - 0.12 * (0.5 + 0.5 * np.sin(2 * np.pi * 4.5 * t))
    return s * env * trem * 0.32 * vel


def chord_rh(freqs, d, vel=1.0, spread=0.012):
    """A voiced chord, notes rolled slightly the way a player's hand lands."""
    n = int(SR * (d + 0.8)) + int(SR * spread * len(freqs))
    out = np.zeros(n)
    for k, f in enumerate(freqs):
        i = int(SR * spread * k)
        x = rhodes(f, d, vel * (0.9 if k else 1.0))
        out[i:i + len(x)] += x
    return out / np.sqrt(len(freqs))


def kalimba(f, d=0.9):
    t = tt(d)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 5.5)
    s += 0.35 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 30)           # metallic overtone
    s += 0.2 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 9)
    return s * np.minimum(1, t / 0.0015) * 0.5


def lofi_kick():
    t = tt(0.5)
    f = 48 + 60 * np.exp(-t * 22)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    return np.tanh(body * 1.3) * 0.85


def snare():
    t = tt(0.35)
    n = fft_filter(noise(0.35), lo=700, hi=6500) * np.exp(-t * 16) * 0.55
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 28) * 0.45
    return (n + body) * 0.8


def rim():
    t = tt(0.08)
    return (np.sin(2 * np.pi * 1700 * t) * 0.5 + fft_filter(noise(0.08), lo=2000, hi=7000) * 0.4) * np.exp(-t * 90) * 0.5


def lofi_hat(open_=False):
    d = 0.22 if open_ else 0.05
    t = tt(d)
    return fft_filter(noise(d), lo=6000, hi=11000) * np.exp(-t * (14 if open_ else 80)) * 0.45


def sub(f, d):
    t = tt(d)
    env = np.minimum(1, t / 0.02) * np.where(t > d - 0.08, np.maximum(0, (d - t) / 0.08), 1.0)
    return (np.sin(2 * np.pi * f * t) + 0.12 * np.sin(4 * np.pi * f * t)) * env * 0.75


def woodblock(f=1400.0):
    t = tt(0.06)
    return np.sin(2 * np.pi * f * t) * np.exp(-t * 110) * 0.5


def thump():
    t = tt(0.6)
    f = 40 + 45 * np.exp(-t * 14)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5) * 0.9


def swell(freqs, d=1.0):
    """A reversed piano chord: swells into the downbeat."""
    x = chord_rh(freqs, d, vel=0.8)[: int(SR * d)][::-1]
    t = tt(d)
    return x * (t / d) ** 1.5


def crackle(d):
    n = int(SR * d)
    out = fft_filter(rng.standard_normal(n), lo=1500, hi=6000) * 0.012          # hiss
    pops = rng.random(n) < 9 / SR                                                  # ~9 pops a second
    idx = np.nonzero(pops)[0]
    for i in idx:
        L = min(n - i, int(SR * 0.004))
        out[i:i + L] += rng.uniform(-1, 1) * 0.18 * np.exp(-np.arange(L) / (SR * 0.0008))
    return out


# ---- harmony: Dm9 – Gm9 – Bbmaj7 – A7, a bar (2 s) each ---------------------------------------
N_ = lambda m: 440.0 * 2 ** ((m - 69) / 12)   # MIDI note -> Hz
CH = {
    'Dm9':    ([N_(50), N_(57), N_(60), N_(64), N_(65)], N_(38)),    # D3 A3 C4 E4 F4 / D2
    'Gm9':    ([N_(55), N_(58), N_(62), N_(65), N_(69)], N_(43)),    # G3 Bb3 D4 F4 A4 / G2
    'Bbmaj7': ([N_(58), N_(62), N_(65), N_(69)], N_(46)),            # Bb3 D4 F4 A4 / Bb2
    'A7':     ([N_(57), N_(61), N_(64), N_(67)], N_(45)),            # A3 C#4 E4 G4 / A2
}
PROG = ['Dm9', 'Gm9', 'Bbmaj7', 'A7']
BAR = 2.0
END = 18.0


def ch_at(t):
    return CH[PROG[int(t // BAR) % 4]]


def calm(s):  # the phone scene: drums thin out so the typing reads
    return 9.0 <= s < 13.0


# ---- arrangement ------------------------------------------------------------------------------
place(pad_b, crackle(DUR), 0.0, gain=1.0)

# Piano: the chord on each bar, and a lighter answer on beat 3 (the "and" feel of half-time)
for k in range(9):
    notes, _ = CH[PROG[k % 4]]
    s = k * BAR
    place(pad_b, chord_rh(notes, 1.4, vel=0.9 if k >= 2 else 0.75), s, pan=-0.1, gain=0.9, rev=0.3)
    if k >= 2:
        place(pad_b, chord_rh(notes[1:], 0.5, vel=0.55), s + 1.25, pan=0.15, gain=0.6, rev=0.3)
place(pad_b, chord_rh(CH['Dm9'][0] + [N_(69)], 2.6, vel=1.0, spread=0.03), END, gain=1.0, rev=0.5)
place(sfx_b, swell(CH['A7'][0], 1.0), 3.0, gain=0.7, rev=0.2)                 # into the drop

# Drums: half-time boom-bap from the drop; thin in the phone scene; one last kick on the final chord
for bar_start in np.arange(4.0, END, BAR):
    for off, g in ((0.0, 1.0), (0.75, 0.75), (1.5, 0.45)):
        s = bar_start + off
        if calm(s) and off != 0.0:
            continue
        place(drums, lofi_kick(), s, gain=g * (0.75 if calm(s) else 1.0))
    s = bar_start + 1.0
    place(drums, rim() if calm(s) else snare(), s, pan=0.05, gain=0.75, rev=0.25)
place(drums, lofi_kick(), END, gain=1.0)
# Hats: eighths with a lazy swing on the off-eighth, open hat at the end of each bar
for i in range(int(4.0 / 0.25), int(END / 0.25)):
    s = i * 0.25
    if calm(s) and s % 0.5:
        continue
    swing = 0.035 if s % 0.5 else 0.0
    open_ = abs((s % 2.0) - 1.75) < 1e-9
    place(drums, lofi_hat(open_), s + swing, pan=0.25, gain=(0.22 if s % 0.5 == 0 else 0.14) * (0.7 if calm(s) else 1.0))

# Sub bass: root on 1 and on the "and" of 2
for bar_start in np.arange(4.0, END, BAR):
    _, root = ch_at(bar_start)
    place(bass_b, sub(root, 0.7), bar_start, gain=0.9 if not calm(bar_start) else 0.7)
    place(bass_b, sub(root, 0.5), bar_start + 0.75, gain=0.7 if not calm(bar_start) else 0.5)
place(bass_b, sub(N_(38), 2.4), END, gain=0.9)

# Seams: a breath of air into 9.0 and 13.0 (the scene whips)
for seam in (9.0, 13.0):
    place(sfx_b, swish(0.25), seam - 0.25, gain=0.45, rev=0.1)
place(drums, crash(1.6) * 0.5, END, gain=0.25, rev=0.4)

# ---- effects, pitched to the chord they land on -----------------------------------------------
# hook: OFFER / NUMBER / MEETUP on D, F, A (Dm9), the line on the chord
for s, m in ((0.5, 74), (1.0, 77), (1.5, 81)):
    place(sfx_b, kalimba(N_(m)), s, pan=(-0.3, 0.0, 0.3)[int((s - 0.5) * 2)], gain=0.55, rev=0.35)
    place(sfx_b, thump() * 0.4, s, gain=0.4)
place(sfx_b, chord_rh(CH['Dm9'][0], 0.8, vel=0.8), 2.0, gain=0.5, rev=0.4)
# offer (bar 3 = Bbmaj7, bar 4 = A7)
place(sfx_b, thump(), 4.0, gain=0.6)
place(sfx_b, kalimba(N_(70)) + 0.7 * kalimba(N_(74)), 4.5, gain=0.4, rev=0.3)    # bar opens (Bb5 D6)
for s in (4.75, 5.0, 5.25):
    place(sfx_b, woodblock(1600.0), s, pan=0.2, gain=0.45)
place(sfx_b, chord_rh([N_(70), N_(74), N_(77), N_(81)], 0.7, vel=0.9), 5.5, gain=0.55, rev=0.35)  # offer lands
place(sfx_b, kalimba(N_(85)) + 0.8 * kalimba(N_(88)), 7.0, gain=0.4, rev=0.35)  # accepted (A7: C#6 E6)
place(sfx_b, kalimba(N_(81), 0.6), 7.25, gain=0.25, rev=0.3)                    # system pill (A5)
# number (bar 5 = Gm9, bar 6 = Bbmaj7)
for k, chx in enumerate('70 000 000'):
    if chx != ' ':
        place(sfx_b, woodblock(1500.0 + 60 * (k % 3)), 9.5 + k * 0.125, pan=0.15, gain=0.4)
place(sfx_b, chord_rh([N_(70), N_(74), N_(77), N_(81)], 0.7, vel=0.9), 11.0, gain=0.55, rev=0.35)  # card (Bbmaj7)
# meetup (bar 7 = A7, bar 8 = Dm9)
place(sfx_b, kalimba(N_(88), 0.5), 13.5, gain=0.3, rev=0.2)                     # tap (E6)
for k, m in enumerate((69, 73, 76, 81)):                                          # picker rises: A7 run
    place(sfx_b, kalimba(N_(m), 0.6), 14.0 + k * 0.125, pan=-0.2 + 0.13 * k, gain=0.3, rev=0.35)
place(sfx_b, thump() * 0.7, 15.0, gain=0.45)                                    # the pin drops
place(sfx_b, kalimba(N_(57), 1.0), 15.0, gain=0.35, rev=0.3)                     # (A3)
place(sfx_b, kalimba(N_(85), 0.5), 15.5, gain=0.28, rev=0.2)                    # Use this spot (C#6)
place(sfx_b, chord_rh([N_(62), N_(69), N_(72), N_(76), N_(77)], 0.8, vel=0.9), 16.0, gain=0.55, rev=0.35)  # card (Dm9)
# outro: the final Dm9 at 18.0, a kalimba run up the chord with the lockup at 18.5
for k, m in enumerate((74, 77, 81, 84, 88)):
    place(sfx_b, kalimba(N_(m), 1.6), 18.5 + k * 0.125, pan=-0.3 + 0.15 * k, gain=0.38, rev=0.5)

# ---- mix: warm, a little worn ----------------------------------------------------------------
t = np.arange(N) / SR
duck = np.ones(N)
for k in [s for s in np.arange(4.0, END, BAR)] + [END]:
    m = t >= k
    duck[m] *= 1 - 0.35 * np.exp(-(t[m] - k) * 8)
bass_b *= duck
pad_b *= duck ** 0.5

IRN = int(SR * 2.2)
ir_t = np.arange(IRN) / SR
wet = np.zeros((2, N))
size = 1 << int(np.ceil(np.log2(N + IRN)))
for c in range(2):
    ir = fft_filter(rng.standard_normal(IRN), lo=200, hi=3800) * np.exp(-ir_t * 2.6)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet[c] = np.fft.irfft(np.fft.rfft(send[c], size) * np.fft.rfft(ir, size), size)[:N]

mix = drums * 0.85 + bass_b * 0.9 + pad_b * 0.8 + sfx_b * 0.95 + wet * 0.3
for c in range(2):
    mix[c] = fft_filter(mix[c], lo=30, hi=9500)   # the lo-fi roll-off
# gentle wow: a slow pitch drift is too costly here; a 0.5 Hz level sway reads as tape
mix *= 1 - 0.03 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.5 * t))
mix = np.tanh(mix * 1.1)
fade = np.ones(N)
fs = int(SR * 20.0)
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
