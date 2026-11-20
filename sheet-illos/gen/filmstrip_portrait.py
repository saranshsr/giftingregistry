#!/usr/bin/env python3
"""Filmstrip of the portrait card lotties (lottie-web canvas renders in ../verify/lw_canvas) over the card look the
front end draws (card gradient + glow, art/portrait_<card>_backdrop.png) with the + button drawn on top as in Figma
(white 40 pt circle at 62,0 in the visuals box) and the card's rounded bottom corners.
usage: filmstrip_portrait.py [--big DIR]  -> ../verify/filmstrip-gr-card-portrait-<card>.jpg (< 15 KB) [+ a full-size copy in DIR]"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); VER = os.path.join(ROOT, 'verify')
TIMES = [0.12, 0.25, 0.38, 0.5, 0.7, 1.15, 2.2, 3.4]
BIG = sys.argv[sys.argv.index('--big') + 1] if '--big' in sys.argv else None


def card_frame(card, f):
    B = np.asarray(Image.open(os.path.join(ROOT, 'art', 'portrait_%s_backdrop.png' % card)).convert('RGB')).astype(np.float32)
    L = np.asarray(Image.open(os.path.join(VER, 'lw_canvas', 'gr-card-portrait-%s__json__f%d.png' % (card, f))).convert('RGBA')).astype(np.float32)
    a = L[..., 3:] / 255.0
    im = Image.fromarray(np.clip(B * (1 - a) + L[..., :3] * a + 0.5, 0, 255).astype(np.uint8))
    S = 4; big = Image.new('RGBA', (im.width * S, im.height * S), (0, 0, 0, 0)); d = ImageDraw.Draw(big)
    d.ellipse([62 * 3 * S, 0, 102 * 3 * S, 40 * 3 * S], fill=(255, 255, 255, 255))
    cx, cy, r, w = 82 * 3 * S, 20 * 3 * S, 7.5 * 3 * S, int(1.6 * 3 * S)
    d.line([cx - r, cy, cx + r, cy], fill=(20, 20, 20, 255), width=w); d.line([cx, cy - r, cx, cy + r], fill=(20, 20, 20, 255), width=w)
    big = big.resize(im.size, Image.LANCZOS); im = im.convert('RGBA'); im.alpha_composite(big)
    # card's rounded bottom corners (r 16 pt) on the page white
    m = Image.new('L', (im.width * S, (im.height + 240) * S), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width * S - 1, (im.height + 240) * S - 1], 16 * 3 * S, fill=255)
    m = m.crop((0, 240 * S, im.width * S, (im.height + 240) * S)).resize(im.size, Image.LANCZOS)
    out = Image.new('RGB', im.size, (255, 255, 255)); out.paste(im.convert('RGB'), (0, 0), m)
    return out


for card in ('collection', 'registry'):
    n = len([x for x in os.listdir(os.path.join(VER, 'lw_canvas')) if x.startswith('gr-card-portrait-%s__json__' % card)])
    frames = [card_frame(card, min(n - 1, int(round(t * 60)))) for t in TIMES]
    w, h = frames[0].size; g = 12
    strip = Image.new('RGB', (len(frames) * (w + g) - g, h), (255, 255, 255))
    for i, fr in enumerate(frames): strip.paste(fr, (i * (w + g), 0))
    if BIG: strip.save(os.path.join(BIG, 'strip_%s.png' % card))
    out = os.path.join(VER, 'filmstrip-gr-card-portrait-%s.jpg' % card)
    for scale, q in ((0.5, 72), (0.45, 66), (0.4, 60), (0.36, 55), (0.32, 50), (0.28, 45), (0.24, 40)):
        s = strip.resize((int(strip.width * scale), int(strip.height * scale)), Image.LANCZOS)
        s.save(out, quality=q, optimize=True)
        if os.path.getsize(out) < 15000: break
    print(out, os.path.getsize(out), s.size, 'times', TIMES)
