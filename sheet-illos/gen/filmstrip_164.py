#!/usr/bin/env python3
"""Filmstrips of the four 20 Nov card lotties (own opaque background), straight from the lottie-web canvas renders in
../verify/lw_canvas (render them first: render.mjs with W/H/FR). Nothing is drawn on top: what you see is the lottie.
usage: filmstrip_164.py [--big DIR] -> ../verify/filmstrip-<base>.jpg (< 15 KB each)"""
import os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); VER = os.path.join(os.path.dirname(HERE), 'verify')
TIMES = [0.12, 0.25, 0.38, 0.5, 0.7, 1.15, 2.2, 3.4]
BIG = sys.argv[sys.argv.index('--big') + 1] if '--big' in sys.argv else None

for base in ('gr-sheet-collection', 'gr-sheet-registry', 'gr-card-portrait-collection', 'gr-card-portrait-registry'):
    frames = [Image.open(os.path.join(VER, 'lw_canvas', '%s__json__f%d.png' % (base, round(t * 60)))).convert('RGB') for t in TIMES]
    w, h = frames[0].size; g = 12
    strip = Image.new('RGB', (len(frames) * (w + g) - g, h), (255, 255, 255))
    for i, fr in enumerate(frames): strip.paste(fr, (i * (w + g), 0))
    if BIG: strip.save(os.path.join(BIG, 'strip_%s.png' % base))
    out = os.path.join(VER, 'filmstrip-%s.jpg' % base)
    for scale, q in ((0.5, 72), (0.45, 66), (0.4, 60), (0.36, 55), (0.32, 50), (0.28, 45), (0.25, 42), (0.22, 40)):
        s = strip.resize((int(strip.width * scale), int(strip.height * scale)), Image.LANCZOS)
        s.save(out, quality=q, optimize=True)
        if os.path.getsize(out) < 15000: break
    print(out, os.path.getsize(out), s.size)
