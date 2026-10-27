"""Post-render A/V checks (sound-design §4.6, music-beat-sync §5).

1. Output audio offset: cross-correlate sharp SFX source files against the NO-BGM delivery around their pinned `from`.
2. BGM lag: cross-correlate the with-BGM delivery against bgm.mp3 trimmed at BGM_START_FRAMES.
3. Beat back-test: every cut and picture event against the design grid; librosa run on both the delivery and the source
   window separates the detector's constant bias from any output delay.
usage: uv run --with librosa --with scipy --python 3.11 python -I av_check.py <with_bgm.mp4> <no_bgm.mp4> pins.json
"""
import json, subprocess, sys
import numpy as np
import librosa

SR, FPS = 48000, 30
with_bgm, no_bgm, pins_path = sys.argv[1:4]
pins = json.load(open(pins_path))
SOURCE_BEAT0, BEAT, TRIM = pins['source_beat0'], pins['beat'], pins['bgm_start_frames']

def load(path, sr=SR):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, '<i2').astype(np.float32) / 32768

report = {'offset_probes': []}
x = load(no_bgm)
for p in pins['probes']:
    src = load(f"../public/sfx/{p['src']}")[: int(0.25 * SR)]
    start = int(p['from'] / FPS * SR)
    a = max(0, start - int(0.2 * SR))
    win = x[a: start + int(0.4 * SR)]
    c = np.correlate(win, src, mode='valid')
    c /= (np.sqrt(np.convolve(win ** 2, np.ones(len(src)), 'valid')) * np.linalg.norm(src) + 1e-9)
    k = int(np.argmax(c))
    report['offset_probes'].append({'src': p['src'], 'from': p['from'], 'measured_f': round((a + k - start) / SR * FPS, 2), 'corr': round(float(c[k]), 3)})
lags = [q['measured_f'] for q in report['offset_probes'] if q['corr'] > 0.5]
report['output_offset_f'] = round(float(np.median(lags)), 2) if lags else None

y = load(with_bgm)
bgm = load('../public/audio/bgm.mp3')[int(TRIM / FPS * SR):]
seg = y[int(2 * SR): int(12 * SR)]; ref = bgm[int(1.8 * SR): int(12.2 * SR)]
from scipy.signal import correlate
cc = correlate(ref, seg, mode='valid')
report['bgm_lag_ms'] = round((0.2 * SR - int(np.argmax(cc))) / SR * 1000, 2)

def grid(sig, sr):
    _, b = librosa.beat.beat_track(y=sig, sr=sr, tightness=400, units='time')
    b = b[(b > 0.8) & (b < len(sig) / sr - 0.8)]
    i = np.arange(len(b)); (T, t0), *_ = np.linalg.lstsq(np.vstack([i, np.ones_like(i)]).T, b, rcond=None)
    return T, t0, float(np.abs(b - (t0 + i * T)).max() * 1000)
yd = librosa.resample(y, orig_sr=SR, target_sr=22050)
src = librosa.resample(bgm[: len(y)], orig_sr=SR, target_sr=22050)
T, t0, mr = grid(yd, 22050)
Ts, t0s, _ = grid(src, 22050)
phase = lambda t0_: ((t0_ - SOURCE_BEAT0) / BEAT - round((t0_ - SOURCE_BEAT0) / BEAT)) * BEAT
report['render_grid'] = {'bpm': round(60 / T, 3), 't0': round(float(t0), 4), 'maxres_ms': round(mr, 1)}
report['detector_bias_f'] = round(phase(t0s) * FPS, 2)
report['output_delay_f'] = round((phase(t0) - phase(t0s)) * FPS, 2)

design = lambda n: (SOURCE_BEAT0 + n * BEAT) * FPS
def luma(path, a, b):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f"select='between(n,{a},{b})',scale=108:192,format=gray", '-vsync', '0', '-f', 'rawvideo', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, 108 * 192).mean(1)
ev = []
for e in pins['events']:
    if e.get('detect') == 'motion_stop':
        # first frame whose frame-to-frame change falls below `thr` after the motion window starts
        a, b = e['window']; L = luma(with_bgm, a, b)
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', with_bgm, '-vf', f"select='between(n,{a},{b})',scale=108:192,format=gray", '-vsync', '0', '-f', 'rawvideo', '-'], capture_output=True).stdout
        fr = np.frombuffer(raw, np.uint8).reshape(-1, 108 * 192).astype(float)
        d = np.abs(np.diff(fr, axis=0)).mean(1)
        idx = next((i + 1 for i in range(len(d)) if d[i] < e['thr']), None)
        f = a + idx if idx is not None else None
    else:
        f = e['frame']
    ev.append({'name': e['name'], 'picture_frame': f, 'design_beat_frame': round(design(e['beat']), 2), 'err_f': None if f is None else round(f - design(e['beat']), 2)})
report['events'] = ev
report['cuts'] = [{'name': c['name'], 'frame': c['frame'], 'err_vs_design_f': round(c['frame'] - design(c['beat']), 2)} for c in pins['cuts']]
report['max_abs_err_f'] = round(max([abs(c['err_vs_design_f']) for c in report['cuts']] + [abs(e['err_f']) for e in ev if e['err_f'] is not None]), 2)
print(json.dumps(report, indent=1))
