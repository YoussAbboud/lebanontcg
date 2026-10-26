"""Post-render A/V checks (sound-design §4.6, music-beat-sync §5).

1. Output audio offset: cross-correlate sharp SFX source files against the NO-BGM render's audio around the
   frames where they were pinned; the lag beyond the design `from` is the pipeline's output offset.
2. Beat back-test: every cut and picture event (the crash hit is detected on the video) against the design grid; librosa
   run on both the delivery and the source window separates the detector's constant bias from any output delay.
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
# librosa on the SOURCE window the film uses: its beat positions carry the detector's own constant bias relative to the
# onset-fitted design grid (SOURCE_BEAT0). Comparing render vs source isolates the output delay from that bias.
src = load('../public/audio/bgm.mp3', 22050)[int(167 / FPS * 22050): int(167 / FPS * 22050) + len(y)]
_, sb = librosa.beat.beat_track(y=src, sr=22050, tightness=400, units='time')
sb = sb[(sb > 1.0) & (sb < len(src) / 22050 - 1.0)]
j = np.arange(len(sb)); (Ts, t0s), *_ = np.linalg.lstsq(np.vstack([j, np.ones_like(j)]).T, sb, rcond=None)
SOURCE_BEAT0, BEAT = 0.014, 60 / 123.992
phase = lambda t0_, T_: ((t0_ - SOURCE_BEAT0) / BEAT - round((t0_ - SOURCE_BEAT0) / BEAT)) * BEAT
report['detector_bias_f'] = round(phase(t0s, Ts) * FPS, 2)          # librosa vs design grid, on the source itself
report['output_delay_f'] = round((phase(t0, T) - phase(t0s, Ts)) * FPS, 2)  # render vs source, same detector

design = lambda n: (SOURCE_BEAT0 + n * BEAT) * FPS
errs = []
for cut in pins['cuts']:
    n = round((cut['frame'] / FPS - SOURCE_BEAT0) / BEAT)
    t_beat = t0 + round((cut['frame'] / FPS - t0) / T) * T
    errs.append({'name': cut['name'], 'frame': cut['frame'], 'design_beat_frame': round(design(n), 2),
                 'err_vs_design_f': round(cut['frame'] - design(n), 2),
                 'err_vs_detected_f': round(cut['frame'] - t_beat * FPS, 2)})
report['cuts'] = errs

# picture events: frame of the visual hit, measured on the video where a detector is given
def luma(path, a, b):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f"select='between(n,{a},{b})',scale=192:108,format=gray",
                          '-vsync', '0', '-f', 'rawvideo', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, 108 * 192).mean(1)
ev = []
for e in pins.get('events', []):
    if e.get('detect') == 'luma_peak':
        a, b = e['window']; L = luma(with_bgm, a, b); f = a + int(np.argmax(np.diff(L)) + 1)
    else:
        f = e['frame']
    ev.append({'name': e['name'], 'picture_frame': f, 'design_beat_frame': round(design(e['beat']), 2), 'err_f': round(f - design(e['beat']), 2)})
report['events'] = ev
report['max_abs_err_f'] = round(max([abs(e['err_vs_design_f']) for e in errs] + [abs(e['err_f']) for e in ev]), 2)
print(json.dumps(report, indent=1))
