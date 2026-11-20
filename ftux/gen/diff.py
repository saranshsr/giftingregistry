#!/usr/bin/env python3
"""GR FTUX (from sheet-illos/gen/diff.py): AE stills (../verify/ae_frames, saveFrameToPng = premultiplied) vs lottie renders
(../verify/lw_<r>, straight alpha), both on black. usage: diff.py [canvas|svg|thorvg] -> table + ../verify/diff_<r>.json
Pass: worst per-frame mean < 1/255."""
import sys, os, json
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); VER = os.path.join(os.path.dirname(HERE), 'verify')
R = sys.argv[1] if len(sys.argv) > 1 else 'canvas'
FR = [6, 12, 18, 24, 30, 36, 45, 60, 75, 90, 120, 150, 180, 210, 240, 270, 300, 329]
base = 'gr-ftux-explainer'
def ae(p): a = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32); return a[..., :3], a[..., 3]
def lw(p): a = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32); return a[..., :3] * (a[..., 3:] / 255.0), a[..., 3]
res = {}; fail = 0
for kind in (('lottie',) if R == 'thorvg' else ('json', 'lottie')):
    rows = []
    for fr in FR:
        pa = os.path.join(VER, 'ae_frames', 'ftux__f%d.png' % fr); pb = os.path.join(VER, 'lw_' + R, '%s__%s__f%d.png' % (base, kind, fr))
        if not (os.path.exists(pa) and os.path.exists(pb)): continue
        (ca, aa), (cb, ab) = ae(pa), lw(pb)
        d = np.abs(ca - cb).mean(axis=2)
        rows.append([fr, round(float(d.mean()), 3), round(float(np.percentile(d, 99.5)), 2), round(float(np.abs(aa - ab).mean()), 3)])
    res[kind] = rows
    wm = max(r[1] for r in rows); wp = max(r[2] for r in rows); bad = wm >= 1.0; fail += bad
    print('%-8s %-6s worst mean %.3f/255  worst p99.5 %.2f  worst alpha %.3f  frames %d %s' % (R, kind, wm, wp, max(r[3] for r in rows), len(rows), 'FAIL' if bad else 'ok'))
    print('   per frame [f, mean, p99.5, alpha]:', rows)
json.dump(res, open(os.path.join(VER, 'diff_%s.json' % R), 'w'), indent=1)
print('fails', fail)
