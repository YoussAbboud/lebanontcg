"""Beat analysis for the reel's BGM (music-beat-sync.md): fitted beat grid, downbeat phase, per-bar energy, kick per beat.
usage: uv run --with librosa --with scipy --python 3.11 python -I beat.py ../public/audio/bgm.mp3 > beat_data.json
"""
import json, sys
import numpy as np, librosa
from scipy.signal import butter, sosfilt

y, sr = librosa.load(sys.argv[1], sr=None, mono=True)
dur = len(y) / sr
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, tightness=400, units="time")
i = np.arange(len(beats)); (T, t0), *_ = np.linalg.lstsq(np.vstack([i, np.ones_like(i)]).T, beats, rcond=None)
res = beats - (t0 + i * T)
t0 = t0 - np.floor(t0 / T) * T  # earliest grid beat >= 0
# kick strength at each grid beat (40-160 Hz percussive onset envelope)
yp = librosa.effects.percussive(y)
sos = butter(4, [40, 160], btype="band", fs=sr, output="sos")
kenv = librosa.onset.onset_strength(y=sosfilt(sos, yp), sr=sr); kt = librosa.times_like(kenv, sr=sr)
grid = t0 + np.arange(int((dur - t0) / T)) * T
kick = [float(kenv[np.argmin(np.abs(kt - g))]) for g in grid]
# downbeat phase: the 4-beat phase whose beats carry the most kick + bass energy
phase = int(np.argmax([np.mean(kick[p::4]) for p in range(4)]))
# per-bar RMS (bar = 4 beats from the downbeat phase)
rms = librosa.feature.rms(y=y)[0]; rt = librosa.times_like(rms, sr=sr)
bars = []
for b in range(phase, len(grid) - 4, 4):
    a, e = grid[b], grid[b + 4]
    bars.append({"bar_start_beat": b, "t": round(float(a), 3), "rms": round(float(rms[(rt >= a) & (rt < e)].mean()), 4)})
print(json.dumps({"bpm": round(60 / T, 3), "T": T, "t0": round(float(t0), 4), "maxres_ms": round(float(np.abs(res).max() * 1000), 1),
                  "downbeat_phase": phase, "beats": [round(float(g), 4) for g in grid], "kick_at_beat": [round(k, 3) for k in kick], "bars": bars}, indent=1))
