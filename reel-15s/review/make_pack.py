"""Review pack: per-shot key frames + contact sheets from a delivery, selected by frame INDEX (0-based = Remotion frame),
and contact sheets of the reference demo renders in review/ref/.
usage: uv run --with pillow --python 3.11 python review/make_pack.py <video.mp4>
"""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

VID = sys.argv[1]
SHOTS = [('S1-opening', 0, 119), ('S2-browse', 119, 251), ('S3-listing', 251, 310), ('S4-end', 310, 450)]
EXTRA = [45, 79, 99, 119, 142, 165, 192, 207, 236, 251, 328, 340, 344, 369, 384, 399, 414, 449]
font = ImageFont.load_default(size=26)
os.makedirs('review/frames', exist_ok=True); os.makedirs('review/sheets', exist_ok=True)
for f in os.listdir('review/frames'):
    os.remove(os.path.join('review/frames', f))

def grab(video, frames, outdir, prefix):
    sel = '+'.join(f'eq(n\\,{f})' for f in frames)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-vf', f'select={sel}', '-vsync', '0', f'{outdir}/_%04d.png'], check=True)
    for i, f in enumerate(frames):
        os.rename(f'{outdir}/_{i + 1:04d}.png', f'{outdir}/{prefix}{f:04d}.png')

def sheet(paths_labels, out, w=270, h=480, cols=8):
    rows = (len(paths_labels) + cols - 1) // cols
    s = Image.new('RGB', (w * cols, h * rows), 'black')
    for i, (p, lab) in enumerate(paths_labels):
        im = Image.open(p).convert('RGB'); im.thumbnail((w, h)); d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 120, 32], fill='black'); d.text((6, 3), lab, fill='white', font=font)
        s.paste(im, ((i % cols) * w, (i // cols) * h))
    s.save(out)

plan = {n: sorted(set([a] + [round(a + (b - 1 - a) * k / 7) for k in range(1, 7)] + [b - 1])) for n, a, b in SHOTS}
want = sorted(set(sum(plan.values(), []) + EXTRA))
grab(VID, want, 'review/frames', 'f')
for n, a, b in SHOTS:
    sheet([(f'review/frames/f{f:04d}.png', f'f{f}') for f in plan[n]], f'review/sheets/{n}.png')

for f in sorted(os.listdir('review/ref')):
    if not f.endswith('.mp4'):
        continue
    c = f[:-4]; os.makedirs(f'review/ref/{c}', exist_ok=True)
    n = int(json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v', '-show_entries', 'stream=nb_read_frames', '-of', 'json', f'review/ref/{f}'], capture_output=True, text=True).stdout)['streams'][0]['nb_read_frames'])
    fr = sorted(set([0] + [round((n - 1) * k / 7) for k in range(1, 8)]))
    grab(f'review/ref/{f}', fr, f'review/ref/{c}', 'f')
    sheet([(f'review/ref/{c}/f{x:04d}.png', f'f{x}') for x in fr], f'review/ref/{c}-sheet.png', w=480, h=270, cols=4)
print(len(want), 'frames')
