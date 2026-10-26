"""Post-render A/V checks (sound-design §4.6, music-beat-sync §5).

1. Output audio offset: cross-correlate sharp SFX source files against the NO-BGM render's audio around the
   frames where they were pinned; the lag beyond the design `from` is the pipeline's output offset.
2. Beat back-test: fit the beat grid on the WITH-BGM render's audio and report every cut's error in frames.
usage: uv run --with librosa --with scipy --python 3.11 av_check.py <with_bgm.mp4> <no_bgm.mp4> <pins.json>
"""
import json, subprocess, sys
import numpy as np

SR = 48000
FPS = 30

def load(path, sr=SR):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, '<i2').astype(np.float32) / 32768

with_bgm, no_bgm, pins_path = sys.argv[1:4]
pins = json.load(open(pins_path))
x = load(no_bgm)
report = {'offset_probes': []}
for p in pins['probes']:
    src = load(f"../public/sfx/{p['src']}")[: int(0.25 * SR)]
    start = int(p['from'] / FPS * SR)
    win = x[max(0, start - int(0.2 * SR)): start + int(0.4 * SR)]
    c = np.correlate(win, src, mode='valid')
    c /= (np.sqrt(np.convolve(win ** 2, np.ones(len(src)), 'valid')) * np.linalg.norm(src) + 1e-9)
    k = int(np.argmax(c))
    t = max(0, start - int(0.2 * SR)) + k
    lag_f = (t - start) / SR * FPS
    report['offset_probes'].append({'src': p['src'], 'from': p['from'], 'measured_f': round(lag_f, 2), 'corr': round(float(c[k]), 3)})
lags = [q['measured_f'] for q in report['offset_probes'] if q['corr'] > 0.5]
report['output_offset_f'] = round(float(np.median(lags)), 2) if lags else None

import librosa
y = load(with_bgm, 22050)
_, beats = librosa.beat.beat_track(y=y, sr=22050, tightness=400, units='time')
beats = beats[(beats > 1.0) & (beats < len(y) / 22050 - 1.0)]
i = np.arange(len(beats)); A = np.vstack([i, np.ones_like(i)]).T
(T, t0), *_ = np.linalg.lstsq(A, beats, rcond=None)
report['render_grid'] = {'bpm': round(60 / T, 3), 't0': round(float(t0), 4), 'maxres_ms': round(float(np.abs(beats - (t0 + i * T)).max() * 1000), 1)}
errs = []
for cut in pins['cuts']:
    t_design = cut['frame'] / FPS
    n = round((t_design - t0) / T)
    t_beat = t0 + n * T
    errs.append({'name': cut['name'], 'frame': cut['frame'], 'nearest_beat_frame': round(t_beat * FPS, 2), 'err_f': round((cut['frame'] - t_beat * FPS), 2)})
report['cuts'] = errs
report['max_abs_err_f'] = round(max(abs(e['err_f']) for e in errs), 2)
print(json.dumps(report, indent=1))
