#!/usr/bin/env python3
"""Six Gift Registry page heroes (Figma 902:195436): cut every piece out of the 3x clone atlas, place it by template
matching into the 3x render of its own hero frame (ref.png), and split free-standing stars / sparkles off each
illustration so they can move on their own.

Comp per hero: x 0..375, y -14..162 pt relative to the hero frame (Figma 'Onboarding hero'), 3x -> 1125 x 528.
    python3 cut_place.py -> ../art/<page>/*.png + ../art/pieces.json"""
import json, os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
FIG = os.path.join(ROOT, 'figma'); ART = os.path.join(ROOT, 'art'); os.makedirs(ART, exist_ok=True)
K = 3; CY0 = -14            # comp top in hero-frame pt
A = np.asarray(Image.open(os.path.join(FIG, 'atlas.png')).convert('RGBA')).astype(np.float32)
R = np.asarray(Image.open(os.path.join(FIG, 'ref.png')).convert('RGBA')).astype(np.float32)
REF_ORIGIN = {'p1': (60, 60), 'p2': (60, 636), 'p3': (60, 1212), 'p4': (60, 1797), 'p5': (60, 2382), 'p6': (60, 2958)}

a = A[..., 3]
lab, n = ndimage.label(ndimage.binary_dilation(a > 8, iterations=22))
def cluster_at(x, y):        # the cluster under (x, y), or the most common one in a 60 px window around it
    v = lab[y, x]
    if v == 0:
        win = lab[max(0, y - 60):y + 60, max(0, x - 60):x + 60]; vals = win[win > 0]
        v = np.bincount(vals).argmax()
    return lab == v
fine, fn = ndimage.label(a > 0)

# atlas clusters (found by size/position; see the notes in the session): page -> {piece: mask}
pieces = {
    'p1': {'sw': cluster_at(300, 120), 'ill': cluster_at(900, 250)},
    'p2': {'sw': cluster_at(1450, 120)},
    'p3': {'ill': cluster_at(2300, 730)},
    'p4': {'sw': cluster_at(300, 1060), 'ill2': cluster_at(1226, 1061), 'ill': cluster_at(1830, 1170)},
    'p5': {'sw': cluster_at(300, 1540), 'ill': cluster_at(880, 1690)},
    'p6': {'sw': cluster_at(1450, 1540), 'ill': cluster_at(250, 2140)},
}
# the merged cluster: p3's swoosh + p2's pin (+ its little star): split by fine components, the pink stroke is the swoosh
merged = cluster_at(800, 600) | cluster_at(1283, 594)
rgb = A[..., :3]
pink = (rgb[..., 0] - rgb[..., 2] > 25) & (rgb[..., 0] > 180) & (a > 0)      # the swoosh is the only pink thing here
box = np.zeros(a.shape, bool); box[490:725, 490:1130] = True                  # p3 swoosh clone box (+ margin)
sw = ndimage.binary_dilation(merged & pink & box, iterations=2) & merged & box & (a > 0)
lsw, nsw = ndimage.label(sw); osw = ndimage.find_objects(lsw)
sw = lsw == (1 + int(np.argmax([(lsw[o] == i + 1).sum() for i, o in enumerate(osw)])))
sw = ndimage.binary_dilation(sw, iterations=2) & merged & (a > 0) & ~(~pink & ndimage.binary_erosion(merged & ~pink, iterations=1))
pieces['p3']['sw'] = sw
pieces['p2']['ill'] = merged & ~sw & (a > 0)

def crop(mask):
    m = ndimage.binary_dilation(mask, iterations=1) & (a > 0)
    ys, xs = np.where(m); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    im = A[y0:y1, x0:x1].copy(); im[..., 3] = np.where(m[y0:y1, x0:x1], im[..., 3], 0)
    return im

def place(im, page):
    """Masked SQDIFF of the piece (premultiplied on white) inside its hero's region of ref.png."""
    ox, oy = REF_ORIGIN[page]
    top = max(0, oy - 80); reg = R[top: oy + 560, 0:1400]
    white = lambda X: X[..., :3] * (X[..., 3:] / 255) + 255 * (1 - X[..., 3:] / 255)
    Rw = white(reg).astype(np.float32); Tw = white(im).astype(np.float32)
    msk = np.repeat((im[..., 3:] > 200).astype(np.float32), 3, axis=2)
    r = cv2.matchTemplate(Rw, Tw, cv2.TM_SQDIFF, mask=msk)
    v, _, loc, _ = cv2.minMaxLoc(r)
    x_pt = (loc[0] - ox) / K; y_pt = (loc[1] + top - oy) / K
    return x_pt, y_pt, float(np.sqrt(v / msk.sum()))

# whole illustrations from the VISIBLE image fills, rendered whole (Figma crops some of them mid-object):
# keep the connected pieces that sit mostly inside Figma's window, so the chosen variant is whole and neighbours stay out
V = np.asarray(Image.open(os.path.join(FIG, 'visible_full.png')).convert('RGBA')).astype(np.float32)
FULL = {  # page: (full image top-left pt, window pt [x, y, w, h], atlas box px)
    'p2': ((-137.78, -46.8), (126.58, -0.04, 121, 128.55), (20, 20, 1193, 666)),
    'p3': ((87, -17), (112, -17, 150, 150), (20, 726, 600, 450)),
    'p4': ((-61.73, -55.29), (110.42, -7, 150, 150), (20, 1216, 1483, 741)),
    'p5': ((51.13, -18), (110.5, -18, 150, 150), (20, 1998, 806, 450)),
    'p6': ((99.69, -67.15), (107.42, -17, 150, 150), (20, 2488, 1383, 747)),
}
def whole(page):
    (fx, fy), (wx, wy, ww, wh), (ax, ay, aw, ah) = FULL[page]
    im = V[ay:ay + ah, ax:ax + aw]; al = im[..., 3]
    win = np.zeros(al.shape, bool)
    x0, y0 = int(round((wx - fx) * K)), int(round((wy - fy) * K)); win[max(0, y0):y0 + int(wh * K), max(0, x0):x0 + int(ww * K)] = True
    lb, nb = ndimage.label(ndimage.binary_dilation(al > 8, iterations=5))
    keep = np.zeros(al.shape, bool); kept = []
    for i in range(1, nb + 1):
        m = lb == i; tot = (m & (al > 8)).sum(); ins = (m & (al > 8) & win).sum()
        if tot and ins / tot > 0.3: keep |= m; kept.append((int(tot), round(ins / tot, 2)))
    keep &= al > 0
    ys, xs = np.where(keep); y1, y2, x1, x2 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    out_im = im[y1:y2, x1:x2].copy(); out_im[..., 3] = np.where(keep[y1:y2, x1:x2], out_im[..., 3], 0)
    beyond = int((keep & ~win & (al > 40)).sum())
    print('%s whole: kept %d pieces %s, %d px that Figma cropped away' % (page, len(kept), kept, beyond))
    return out_im, (fx * K + x1, (fy - CY0) * K + y1)

out = {}
for page, d in pieces.items():
    pd = os.path.join(ART, page); os.makedirs(pd, exist_ok=True); out[page] = {}
    for key, mask in d.items():
        if key == 'ill' and page in FULL:
            im, (cx, cy) = whole(page); err = 0.0; x_pt, y_pt = cx / K, cy / K + CY0
        else:
            im = crop(mask)
            x_pt, y_pt, err = place(im, page)
            cx, cy = x_pt * K, (y_pt - CY0) * K            # comp px
        entry = {'x': round(float(cx), 1), 'y': round(float(cy), 1), 'w': int(im.shape[1]), 'h': int(im.shape[0]), 'err': round(float(err), 1)}
        if key.startswith('ill'):
            # free-standing bits (stars, sparkles, gems) away from the main body move on their own
            al = im[..., 3]; fl, fnn = ndimage.label(al > 0); fo = ndimage.find_objects(fl)
            ar = [(fl[o] == i + 1).sum() for i, o in enumerate(fo)]
            main = int(np.argmax(ar)); extras = []
            # group tiny specks with the nearest bigger bit
            big = [i for i in range(fnn) if i != main and ar[i] >= 250]
            cen = lambda i: ((fo[i][0].start + fo[i][0].stop) / 2, (fo[i][1].start + fo[i][1].stop) / 2)
            groups = {i: [i] for i in big}
            for i in range(fnn):
                if i == main or i in big: continue
                if big:
                    j = min(big, key=lambda q: (cen(q)[0] - cen(i)[0]) ** 2 + (cen(q)[1] - cen(i)[1]) ** 2)
                    if (cen(j)[0] - cen(i)[0]) ** 2 + (cen(j)[1] - cen(i)[1]) ** 2 < 50 ** 2: groups[j].append(i); continue
                groups.setdefault(main, []).append(i)
            body = fl == main + 1
            for i in groups.get(main, []): body |= fl == i + 1
            for gi, (bi, members) in enumerate(sorted(((b, m) for b, m in groups.items() if b != main), key=lambda t: cen(t[0])[1])):
                mm = np.zeros(al.shape, bool)
                for i in members: mm |= fl == i + 1
                mm = ndimage.binary_dilation(mm, iterations=2) & (al > 0) & ~ndimage.binary_erosion(body, iterations=3)
                ys, xs = np.where(mm); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
                pim = im[y0:y1, x0:x1].copy(); pim[..., 3] = np.where(mm[y0:y1, x0:x1], pim[..., 3], 0)
                nm = '%s_bit%d' % (key, gi + 1)
                # a bit Figma hides under a separate picture (e.g. 2.5's purple star under its white sparkle) is dropped
                cover = out[page].get('ill2')
                if cover:
                    bx0, by0, bx1, by1 = cx + x0, cy + y0, cx + x1, cy + y1
                    ix = max(0, min(bx1, cover['x'] + cover['w']) - max(bx0, cover['x'])); iy = max(0, min(by1, cover['y'] + cover['h']) - max(by0, cover['y']))
                    if ix * iy > 0.5 * (x1 - x0) * (y1 - y0):
                        print('   %s %s: hidden under ill2 in Figma, dropped' % (page, nm)); body &= ~mm; continue
                Image.fromarray(np.clip(pim, 0, 255).astype(np.uint8)).save(os.path.join(pd, nm + '.png'))
                out[page][nm] = {'x': round(float(cx + x0), 1), 'y': round(float(cy + y0), 1), 'w': int(x1 - x0), 'h': int(y1 - y0)}
                body &= ~mm
            im2 = im.copy(); im2[..., 3] = np.where(body | (al == 0), im2[..., 3], 0)
            im = im2
        Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)).save(os.path.join(pd, key + '.png'))
        out[page][key] = entry
        print('%s %-8s at (%.1f, %.1f) pt  %dx%d px  rms %.1f' % (page, key, x_pt, y_pt, im.shape[1], im.shape[0], err))
    bits = [k for k in out[page] if '_bit' in k]
    if bits: print('   %s bits: %s' % (page, ', '.join('%s %dx%d' % (k, out[page][k]['w'], out[page][k]['h']) for k in bits)))
json.dump(out, open(os.path.join(ART, 'pieces.json'), 'w'), indent=1)
