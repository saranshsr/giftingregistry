#!/usr/bin/env python3
"""Per-occasion title gradient pictures (17 Nov 2026). Figma themes board (Zs6qEAZ1Uaej4LcKst0sbp, section 575:158585):
every theme's title is a linear gradient #000000 -> occasion colour with one gradientTransform over the title TEXT box.
usage: title_grad_occ.py <layers.json>   (AE dump per comp: [name, file, w, h, posX, posY, anchorX, anchorY, scaleX, scaleY, nkeys, rot])
Writes ../art/title_grad/gr_title_grad_<occ>_<page>.<md5-8>.png (same pixel grid as the picture it replaces) and
../art/title_grad/map.json {comp: png}. Default keeps its picture. Also checks the geometry against the old picture."""
import hashlib, json, os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(os.path.dirname(HERE), 'art', 'title_grad')
GT = [[1.0579915046691895, -0.21844482421875, -0.19063614308834076], [-2.8249966810278693e-9, 0.2773491144180298, 0.3613254427909851]]
COL = {'Birthday': 'ff578f', "Mother's day": 'ff578f', 'Eid': 'c98a24', 'Wedding': 'ee6f5f', 'Anniversary': 'ee6f5f',
       'Baby shower': '3f8fd6', 'House warming': 'd4813f', 'Other': 'cf9a3e'}
# title TEXT box in hero-frame pt = Figma render bounds xy (prep_heroes PAGES) + (box - render bounds) of the page title node
PAGE = {'1.3 When is it': ('p1', (0.0, 76.04, 374.0, 48.0)), '1.4 Delivery details': ('p2', (0.0, 76.04, 374.0, 48.0)),
        '2.3 Whose is it': ('p3', (0.0, 87.98, 374.0, 56.0)), '2.5 Due date': ('p4', (0.0, 87.98, 374.0, 56.0)),
        '1.1 Occasion': ('p5', (0.0, 96.04, 374.0, 48.0)), 'Name your registry': ('p6', (0.0, 88.0, 374.0, 56.0))}
def field(w, h, x0, y0, F, box):
    yy, xx = np.mgrid[0:h, 0:w]; X = x0 + (xx + 0.5) * F; Y = y0 + (yy + 0.5) * F       # comp px at pixel centres
    bx, by, bw, bh = box; xn = (X / 3.0 - bx) / bw; yn = ((Y / 3.0 - 14.0) - by) / bh     # comp px -> hero pt (3x, y0 = -14 pt)
    return np.clip(GT[0][0] * xn + GT[0][1] * yn + GT[0][2], 0, 1)
def main():
    rows = json.load(open(sys.argv[1])); os.makedirs(OUT, exist_ok=True); mp = {}
    for name, f, w, h, px, py, ax, ay, sx, sy, nk, rot in rows:
        screen, occ = name.replace('GR hero ', '').rsplit(' - ', 1)
        if occ == 'Default': continue
        assert nk == 0 and rot == 0 and abs(sx - sy) < 1e-9, name
        page, box = PAGE[screen]; F = sx / 100.0
        u = field(w, h, px - ax * F, py - ay * F, F, box)
        old = np.asarray(Image.open(f).convert('RGB')).astype(float)
        m = u > 0.5; c_old = (old[m] / u[m, None]).mean(axis=0)                          # old end colour, then old vs same field
        geo = np.abs(old - c_old[None, None] * u[..., None]).max()
        c = np.array([int(COL[occ][i:i + 2], 16) for i in (0, 2, 4)], float)
        im = Image.fromarray(np.dstack([(c[None, None] * u[..., None]).round().astype(np.uint8), np.full(u.shape, 255, np.uint8)]))
        tmp = os.path.join(OUT, '_tmp.png'); im.save(tmp, optimize=True)
        hsh = hashlib.md5(open(tmp, 'rb').read()).hexdigest()[:8]
        slug = occ.lower().replace(' ', '').replace("'", '')
        dst = os.path.join(OUT, 'gr_title_grad_%s_%s.%s.png' % (slug, page, hsh)); os.replace(tmp, dst); mp[name] = dst
        print('%-44s %s old end #%02x%02x%02x  geometry max|d| %.1f -> %s' % (name, page, *[int(round(v)) for v in c_old], geo, os.path.basename(dst)))
    json.dump(mp, open(os.path.join(OUT, 'map.json'), 'w'), indent=1)
    print(len(mp), 'comps,', len(set(mp.values())), 'pictures')
if __name__ == '__main__': main()
