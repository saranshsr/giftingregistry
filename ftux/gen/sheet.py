#!/usr/bin/env python3
"""contact sheet of PNG frames over white (the sheet surface): sheet.py out.jpg maxbytes w_each img1 img2 ... [--crop x0,y0,x1,y1]"""
import sys, io
from PIL import Image
args = sys.argv[1:]
crop = None
if '--crop' in args:
    k = args.index('--crop'); crop = tuple(int(v) for v in args[k + 1].split(',')); args = args[:k] + args[k + 2:]
out, maxb, we = args[0], int(args[1]), int(args[2]); files = args[3:]
tiles = []
for f in files:
    im = Image.open(f).convert('RGBA')
    if crop: im = im.crop(crop)
    bg = Image.new('RGBA', im.size, (255, 255, 255, 255)); bg.alpha_composite(im); im = bg.convert('RGB')
    im = im.resize((we, round(im.height * we / im.width)), Image.LANCZOS); tiles.append(im)
cols = min(len(tiles), 4); rows = (len(tiles) + cols - 1) // cols
th = max(t.height for t in tiles)
sheet = Image.new('RGB', (cols * we + (cols - 1) * 4, rows * th + (rows - 1) * 4), (60, 60, 60))
for i, t in enumerate(tiles): sheet.paste(t, ((i % cols) * (we + 4), (i // cols) * (th + 4)))
q = 80
while True:
    b = io.BytesIO(); sheet.save(b, 'JPEG', quality=q)
    if b.tell() <= maxb or q <= 20: break
    q -= 5
open(out, 'wb').write(b.getvalue()); print(out, b.tell(), 'q', q, sheet.size)
