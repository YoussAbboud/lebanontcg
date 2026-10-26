import json, numpy as np, librosa
from scipy.signal import butter, sosfilt
y, sr = librosa.load("../public/audio/bgm.mp3", sr=None, mono=True)
dur = len(y)/sr
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, tightness=400, units="time")
def fit(b):
    i = np.arange(len(b)); A = np.vstack([i, np.ones_like(i)]).T
    (T, t0), *_ = np.linalg.lstsq(A, b, rcond=None); r = b - (t0 + i*T)
    return T, t0, r
T, t0, r = fit(beats)
print(f"beat_track tempo={float(np.atleast_1d(tempo)[0]):.2f} fit BPM={60/T:.3f} t0={t0:.4f} T={T:.5f} maxres={np.abs(r).max()*1000:.1f}ms n={len(beats)} dur={dur:.1f}")
# hpss percussive onsets for validation of 0.5x/1x/2x grids
yp = librosa.effects.percussive(y)
def band_env(lo, hi):
    sos = butter(4, [lo, hi], btype="band", fs=sr, output="sos")
    env = librosa.onset.onset_strength(y=sosfilt(sos, yp), sr=sr)
    return env, librosa.times_like(env, sr=sr)
kick, times = band_env(40, 160)
on = librosa.onset.onset_detect(onset_envelope=kick, sr=sr, units="time")
res = {}
for k, Tk in (("0.5x", T*2), ("1x", T), ("2x", T/2)):
    n = int((dur - t0)/Tk); grid = t0 + np.arange(n)*Tk
    d = np.array([np.min(np.abs(on - g)) for g in grid])
    match = float(np.mean(d < 0.035)); mae = float(np.mean(d[d < 0.035])*1000) if np.any(d<0.035) else None
    res[k] = {"T": Tk, "match": round(match,3), "mean_abs_ms": round(mae,1) if mae else None}
print(res)
# drift: residual of matched onsets vs grid over time
grid = t0 + np.arange(int((dur-t0)/T))*T
pairs = [(g, on[np.argmin(np.abs(on-g))]-g) for g in grid if np.min(np.abs(on-g))<0.035]
gx = np.array([p[0] for p in pairs]); gy = np.array([p[1] for p in pairs])
slope = np.polyfit(gx, gy, 1)[0]; print(f"drift over track {slope*dur*1000:.1f} ms")
rms = librosa.feature.rms(y=y)[0]; rt = librosa.times_like(rms, sr=sr)
# per-bar (4 beats) RMS
bars = []
for b in range(int((dur-t0)/(4*T))):
    a, z = t0 + b*4*T, t0 + (b+1)*4*T
    m = (rt>=a)&(rt<z); bars.append(round(float(np.mean(rms[m])),4))
kick_at = []
for n in range(int((dur-t0)/T)):
    t = t0 + n*T; kick_at.append(round(float(kick[np.argmin(np.abs(times-t))]),3))
json.dump({"bpm": 60/T, "t0": t0, "T": T, "beats": beats.tolist(), "grids": res, "bar_rms": bars, "kick_at_beat": kick_at,
           "onsets": on.tolist()}, open("beat_data.json","w"))
print("bar rms (first 40 bars):", bars[:40])
