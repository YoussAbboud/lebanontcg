"""Grid validation on the film window (music-beat-sync §1/§3): least-squares grid over the steady section,
then match / mean_abs / drift of 0.5x / 1x / 2x candidates against kick+snare transients."""
import json, sys
import numpy as np, librosa
from scipy.signal import butter, sosfilt, find_peaks
y, sr = librosa.load(sys.argv[1], sr=None, mono=True)
a, b = 12.0, 62.0
seg = y[int(a*sr):int(b*sr)]
tempo, beats = librosa.beat.beat_track(y=seg, sr=sr, tightness=400, units='time')
beats = beats + a
i = np.arange(len(beats)); (T, t0), *_ = np.linalg.lstsq(np.vstack([i, np.ones_like(i)]).T, beats, rcond=None)
res = beats - (t0 + i*T)
print(json.dumps({'window': [a,b], 'bpm': 60/T, 'T': T, 't0_first_beat_in_window': t0, 'maxres_ms': float(np.abs(res).max()*1000), 'n': len(beats)}))
yp = librosa.effects.percussive(y)
def onsets(lo, hi):
    sos = butter(4, [lo, hi], btype='band', fs=sr, output='sos')
    env = librosa.onset.onset_strength(y=sosfilt(sos, yp).astype(np.float32), sr=sr).astype(np.float64)
    t = librosa.times_like(env, sr=sr)
    pk, _ = find_peaks(env, height=env.max()*0.2, distance=8)
    return t[pk]
tr = np.sort(np.concatenate([onsets(40,160), onsets(150,500)]))
tr = tr[(tr>a)&(tr<b)]
out = {}
for name, k in (('0.5x', 2.0), ('1x', 1.0), ('2x', 0.5)):
    Tk = T*k
    best=None
    for ph in np.linspace(0, Tk, 64, endpoint=False):
        g = t0 + ph
        grid = g + np.arange(int((b-g)/Tk))*Tk
        grid = grid[grid>a]
        d = np.abs(grid[:,None]-tr[None,:]).min(1)
        m = (d<0.03).mean(); ma = d[d<0.03].mean()*1000 if (d<0.03).any() else 999
        sc = (m, -ma)
        if best is None or sc>best[0]: best=(sc, ph, m, ma, grid)
    sc, ph, m, ma, grid = best
    d = grid - np.array([tr[np.argmin(np.abs(tr-g))] for g in grid])
    drift = np.polyfit(grid, d, 1)[0]*(b-a)*1000
    out[name] = {'T': Tk, 'phase_offset_s': round(float(ph),4), 'match': round(float(m),3), 'mean_abs_ms': round(float(ma),2), 'drift_ms_over_window': round(float(drift),2), 'first_grid_t': round(float(grid[0]),4)}
print(json.dumps(out, indent=1))
# kick strength at integer beats of the 1x grid in the film window (track beats 25..67)
sos = butter(4, [40,160], btype='band', fs=sr, output='sos')
kenv = librosa.onset.onset_strength(y=sosfilt(sos, yp).astype(np.float32), sr=sr); kt = librosa.times_like(kenv, sr=sr)
b25 = t0 - 7*T
ks = [(n, round(float(kenv[np.argmin(np.abs(kt-(b25+n*T)))]),2)) for n in range(0,43)]
print('film beat kick:', ks)
rms = librosa.feature.rms(y=y)[0]; rt = librosa.times_like(rms, sr=sr)
print('film beat rms:', [(n, round(float(rms[(rt>=b25+n*T)&(rt<b25+(n+1)*T)].mean()),3)) for n in range(0,43)])
print('track beat 25 at', b25)
