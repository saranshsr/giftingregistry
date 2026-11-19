#!/usr/bin/env python3
"""Stacking check: for every pair of overlapping parts in each icon's resting layout, ask the reference which one is on
top, and compare with our layer order (gen/icons.json, front -> back).

Per overlap pixel (not covered by any layer in front of both), the reference colour is compared with each part's
colour; the part it matches clearly better "wins" that pixel. A pair is flagged when the part we put behind wins a
real share of the decisive pixels: that is a wrong stacking, or a part that threads through another (needs a split,
like the registry ring / eyelet and the popper sprays / mouth).
usage: check_layers.py [--png <out dir>]   (writes a crop of each flagged overlap)"""
import json, os, re, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
D = json.load(open(os.path.join(HERE, 'icons.json')))
REFS = {'occasion': 'Occasion', 'whose': 'Name', 'name-your-registry': 'Registry_Name', 'when': 'Date', 'due-date': 'Due_Date',
        'delivery': 'Address'}
MIN_PX, MARGIN, FLAG = 60, 0.04, 0.35   # below ~35 % is the regenerated parts' own mismatch with the originals


def stem(L):
    b = os.path.basename(L['file']).rsplit('.', 1)[0]
    b = re.sub(r'^\d+_', '', b)
    return re.sub(r'_(Front|Long|Holes)$', '', b)


def placed(L):
    p = os.path.join(ROOT, L['file'] if L['file'].startswith('art/') else 'assets/' + L['file'])
    im = Image.open(p).convert('RGBA'); s = L['s']
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    c = Image.new('RGBA', (600, 600), (0, 0, 0, 0)); c.paste(im, (round(L['x']), round(L['y'])), im)
    a = np.asarray(c).astype(np.float32) / 255.0
    return a[..., :3] * a[..., 3:4], a[..., 3]


def main():
    out_dir = sys.argv[sys.argv.index('--png') + 1] if '--png' in sys.argv else None
    bad = 0
    for ic in D['icons']:
        ref = np.asarray(Image.open(os.path.join(ROOT, 'assets', 'Original_References', REFS[ic['slug']] + '.png')).convert('RGBA')).astype(np.float32) / 255.0
        rc = ref[..., :3] * ref[..., 3:4]
        Ls = ic['layers']; P = [placed(L) for L in Ls]
        rows = []
        for i in range(len(Ls)):
            for j in range(i + 1, len(Ls)):           # i is in front of j in our stack
                front = np.zeros((600, 600), np.float32)
                for k in range(i):                    # layers in front of both
                    front = np.maximum(front, P[k][1])
                m = (P[i][1] > 0.6) & (P[j][1] > 0.6) & (front < 0.1)
                n = int(m.sum())
                if n < MIN_PX or stem(Ls[i]) == stem(Ls[j]): continue   # pieces cut from one part
                di = np.abs(rc - P[i][0]).sum(-1)[m]; dj = np.abs(rc - P[j][0]).sum(-1)[m]
                wi = int((di < dj - MARGIN).sum()); wj = int((dj < di - MARGIN).sum())
                dec = wi + wj
                if dec < MIN_PX // 2: continue
                share = wj / dec
                flag = share > FLAG
                rows.append((flag, Ls[i]['name'], Ls[j]['name'], n, share))
                if flag:
                    bad += 1
                    if out_dir:
                        ys, xs = np.nonzero(m); x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max()
                        pad = 30; box = (max(0, x0 - pad), max(0, y0 - pad), min(600, x1 + pad), min(600, y1 + pad))
                        Image.fromarray((ref * 255).astype(np.uint8)).crop(box).save(
                            os.path.join(out_dir, 'flag_%s_%s__%s.png' % (ic['slug'], Ls[i]['name'].replace(' ', '-'), Ls[j]['name'].replace(' ', '-'))))
        print('==', ic['comp'])
        for flag, a, b, n, share in rows:
            print('  %s %-22s over %-22s overlap %5d px, reference shows the back part on %3.0f%%' % ('FLAG' if flag else ' ok ', a, b, n, share * 100))
    print('flagged pairs:', bad)


if __name__ == '__main__':
    main()
