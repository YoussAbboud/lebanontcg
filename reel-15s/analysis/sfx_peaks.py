"""SFX peak lag table (sound-design §4.6): frames from a file's start to its loudest moment, so a pin's `from` can be
set to land the peak on the picture event. Method: mono 48 kHz, 1600-sample (33 ms) mean-|x| envelope, argmax.
usage: uv run --with numpy --python 3.11 python -I sfx_peaks.py ../public/sfx > sfx_peaks.json
"""
import json, os, subprocess, sys
import numpy as np

SR, FPS = 48000, 30
d = sys.argv[1]
out = {}
for f in sorted(os.listdir(d)):
    if not f.endswith('.mp3'):
        continue
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(d, f), '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, '<i2').astype(np.float32) / 32768
    env = np.convolve(np.abs(x), np.ones(1600) / 1600, 'same')
    out[f] = {'dur_s': round(len(x) / SR, 2), 'peak_db': round(float(20 * np.log10(np.abs(x).max() + 1e-9)), 1), 'peak_lag_f': round(int(np.argmax(env)) / SR * FPS, 1)}
print(json.dumps(out, indent=1))
