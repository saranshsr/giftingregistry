#!/usr/bin/env python3
"""Compare AE stills with lottie-web renders on black. usage: diff.py [renderer=canvas] [substr] -> prints table, writes diff_<renderer>.json"""
import sys, os, glob, json, re
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
R = sys.argv[1] if len(sys.argv) > 1 else 'canvas'; ONLY = sys.argv[2] if len(sys.argv) > 2 else ''
sys.path.insert(0, HERE)
FR = [27, 45, 60, 96, 203]
def on_black(p):
    a = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32)
    return a[..., :3] * (a[..., 3:4] / 255.0)
def slug(n):
    n = n.replace('GR hero ', ''); s, o = n.rsplit(' - ', 1)
    return 'gr-hero-%s-%s' % (re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-'), re.sub(r'[^a-z0-9]+', '-', o.lower()).strip('-'))
res = {}
for f in sorted(glob.glob(os.path.join(HERE, 'dump', '*.json'))):
    name = os.path.basename(f)[:-5]
    base = slug(name)
    if ONLY and ONLY not in base: continue
    safe = re.sub(r'[^A-Za-z0-9 _.-]', '_', name)
    res[base] = {}
    for kind in ('json', 'lottie'):
        rows = []
        for fr in FR:
            a = on_black(os.path.join(HERE, 'ae_frames', '%s__f%d.png' % (safe, fr)))
            b = on_black(os.path.join(HERE, 'lw_' + R, '%s__%s__f%d.png' % (base, kind, fr)))
            d = np.abs(a - b).mean(axis=2)  # per-pixel mean over rgb
            rows.append((float(d.mean()), float(np.percentile(d, 99.5))))
        res[base][kind] = rows
json.dump(res, open(os.path.join(HERE, 'diff_%s.json' % R), 'w'))
fail = 0
for base, r in res.items():
    wm = {k: max(x[0] for x in v) for k, v in r.items()}; wp = {k: max(x[1] for x in v) for k, v in r.items()}
    bad = any(wm[k] > 3 or wp[k] > 40 for k in r)
    fail += bad
    print('%-48s json %.2f/%.1f  lottie %.2f/%.1f %s' % (base, wm['json'], wp['json'], wm['lottie'], wp['lottie'], 'FAIL' if bad else ''))
print('fails', fail, 'of', len(res))
