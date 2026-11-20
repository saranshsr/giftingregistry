#!/usr/bin/env python3
"""Compare AE stills (../verify/ae_frames, saveFrameToPng = premultiplied RGB) with lottie-web renders (../verify/lw_<r>, straight
alpha), both on black. Adapted from occasions/exporter/diff.py. usage: diff.py [renderer=canvas] [portrait] -> table + ../verify/diff_<r>[_portrait].json"""
import sys, os, json, re
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); VER = os.path.join(os.path.dirname(HERE), 'verify')
R = sys.argv[1] if len(sys.argv) > 1 else 'canvas'
FR = [4, 8, 12, 16, 20, 24, 32, 40, 48, 60, 66, 70, 120, 180, 240, 275]
COMPS = {'GR sheet _ Collection': 'gr-sheet-collection', 'GR sheet _ Gift registry': 'gr-sheet-registry'}
PORT = 'portrait' in sys.argv[2:]
B164 = '164' in sys.argv[2:]          # the 20 Nov '164 bg' / 'full card' comps (own background)
AEF = 'ae_frames_portrait' if PORT else ('ae_frames_164' if B164 else 'ae_frames')
if B164:
    FR = [4, 8, 12, 16, 20, 24, 32, 40, 48, 60, 66, 70, 100, 120, 150, 180, 210, 240, 275]
    COMPS = {'GR sheet _ Collection _ 164 bg': 'gr-sheet-collection', 'GR sheet _ Gift registry _ 164 bg': 'gr-sheet-registry',
             'GR card _ Collection _portrait_ _ full card': 'gr-card-portrait-collection', 'GR card _ Gift registry _portrait_ _ full card': 'gr-card-portrait-registry'}
if PORT:
    FR = [4, 8, 12, 16, 20, 24, 32, 40, 48, 60, 66, 70, 100, 120, 150, 180, 210, 240, 276]
    COMPS = {'GR card _ Collection _portrait_': 'gr-card-portrait-collection', 'GR card _ Gift registry _portrait_': 'gr-card-portrait-registry'}


def ae(p):
    a = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32); return a[..., :3], a[..., 3]


def lw(p):
    a = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32); return a[..., :3] * (a[..., 3:] / 255.0), a[..., 3]


res = {}; fail = 0
for safe, base in COMPS.items():
    res[base] = {}
    for kind in (('lottie',) if R == 'thorvg' else ('json', 'lottie')):
        rows = []
        for fr in FR:
            pa = os.path.join(VER, AEF, '%s__f%d.png' % (safe, fr)); pb = os.path.join(VER, 'lw_' + R, '%s__%s__f%d.png' % (base, kind, fr))
            if not (os.path.exists(pa) and os.path.exists(pb)): continue
            (ca, aa), (cb, ab) = ae(pa), lw(pb)
            d = np.abs(ca - cb).mean(axis=2)
            rows.append([fr, round(float(d.mean()), 3), round(float(np.percentile(d, 99.5)), 2), round(float(np.abs(aa - ab).mean()), 3)])
        res[base][kind] = rows
        wm = max(r[1] for r in rows); wp = max(r[2] for r in rows)
        bad = wm >= 1.0
        fail += bad
        print('%-22s %-6s worst mean %.3f/255  worst p99.5 %.2f  frames %d %s' % (base, kind, wm, wp, len(rows), 'FAIL' if bad else 'ok'))
json.dump(res, open(os.path.join(VER, 'diff_%s%s.json' % (R, '_portrait' if PORT else ('_164' if B164 else ''))), 'w'), indent=1)
print('fails', fail)
