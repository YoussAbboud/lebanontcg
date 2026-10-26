"""Review pack: per-shot key frames + contact sheets from the delivery, selected by frame INDEX (0-based, = Remotion frame).
usage: uv run --with pillow --python 3.11 python review/make_pack.py out/promo.mp4
"""
import os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

VID = sys.argv[1]
SHOTS = [('S0-open', 0, 117), ('S1-hero', 117, 291), ('S2-deal', 291, 450), ('T1', 450, 509), ('S3-auction', 509, 668), ('T2', 668, 726),
         ('S4-chat', 726, 842), ('T3', 842, 900), ('S5-pregrade', 900, 1046), ('S6-outro', 1046, 1220)]
EXTRA = [551, 552, 553, 1133, 1134, 1219]
os.makedirs('review/frames', exist_ok=True); os.makedirs('review/sheets', exist_ok=True)
for f in os.listdir('review/frames'):
    os.remove(os.path.join('review/frames', f))
plan = {name: sorted(set([a] + [round(a + (b - 1 - a) * k / 7) for k in range(1, 7)] + [b - 1])) for name, a, b in SHOTS}
want = sorted(set(sum(plan.values(), []) + EXTRA))
sel = '+'.join(f'eq(n\\,{f})' for f in want)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', VID, '-vf', f'select={sel}', '-vsync', '0', 'review/frames/_%04d.png'], check=True)
for i, f in enumerate(want):
    os.rename(f'review/frames/_{i + 1:04d}.png', f'review/frames/f{f:04d}.png')
font = ImageFont.load_default(size=28)
for name, a, b in SHOTS:
    W, H = 640, 360
    sheet = Image.new('RGB', (W * 4, H * 2), 'black')
    for i, f in enumerate(plan[name][:8]):
        im = Image.open(f'review/frames/f{f:04d}.png').convert('RGB').resize((W, H))
        d = ImageDraw.Draw(im); d.rectangle([0, 0, 150, 40], fill='black'); d.text((8, 4), f'f{f}', fill='white', font=font)
        sheet.paste(im, ((i % 4) * W, (i // 4) * H))
    sheet.save(f'review/sheets/{name}.png')
print(len(want), 'frames')
