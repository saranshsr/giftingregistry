"""Derived art for the icon comps (writes icons/art/, never touches icons/assets/).

- Occasion_Canister_Front.png: the canister with its open mouth cut away (everything inside the inner-rim ellipse above
  its lower arc), so the sprays can sit between the full canister (back) and this piece and rise out of the mouth.
- bboxes.json: each part's opaque bounds and anchor helpers in its own PNG pixels.
"""
import json, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
A = os.path.join(ROOT, 'assets'); ART = os.path.join(ROOT, 'art'); os.makedirs(ART, exist_ok=True)

# canister mouth (inner rim) in canister PNG pixels, traced from the dark interior: x 52..212, y 21..48
CX, CY, RX, RY = 132.0, 34.5, 81.0, 14.5


def canister_front():
    im = Image.open(os.path.join(A, '02_Occasion', '01_Occasion_Canister.png')).convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # signed "inside the ellipse" with a 1.5 px soft edge, extended straight up above the centre line (open mouth)
    r = np.sqrt(((xx - CX) / RX) ** 2 + ((yy - CY) / RY) ** 2)
    inside = np.clip((1.0 - r) * RY / 1.5 + 0.5, 0, 1)
    above = (yy < CY) & (np.abs(xx - CX) < RX)
    cut = np.maximum(inside, above.astype(np.float32) * np.clip((RX - np.abs(xx - CX)) / 1.5 + 0.5, 0, 1))
    a[..., 3] *= (1.0 - cut)
    Image.fromarray(a.astype(np.uint8)).save(os.path.join(ART, 'Occasion_Canister_Front.png'))


SPRAYS = ['03_Occasion_Spray_Inner_Left', '04_Occasion_Spray_Inner_Right', '02_Occasion_Spray_Left', '05_Occasion_Spray_Right']
EXT = 80   # PNG px of stem added below each spray (~40 comp px): they end behind the canister's front lip


def spray_long(name):
    """The spray with its stem continued down along its own direction, darkening as it goes into the canister."""
    im = np.asarray(Image.open(os.path.join(A, '02_Occasion', name + '.png')).convert('RGBA')).astype(np.float32)
    h, w = im.shape[:2]
    al = im[..., 3] > 128
    ys = np.nonzero(al.any(1))[0]; b = ys.max()
    cx = lambda y: np.nonzero(al[y])[0].mean()
    slope = (cx(b - 3) - cx(b - 24)) / 21.0                 # dx per dy along the stem's last stretch
    sl = im[b - 7:b - 1].copy()                            # a 6-row slice just above the rounded tip
    out = np.zeros((h + EXT, w, 4), np.float32)
    for k in range(EXT, 0, -1):                            # stamp from deepest up, original on top
        dark = 1.0 - 0.5 * (k / EXT)
        dx = int(round(slope * (k + 4)))
        y0 = b - 7 + k + 4
        src = sl.copy(); src[..., :3] *= dark
        xs0, xs1 = max(0, dx), min(w, w + dx)
        seg = src[:, xs0 - dx:xs1 - dx]
        dst = out[y0:y0 + 6, xs0:xs1]
        a = seg[..., 3:4] / 255.0
        dst[..., :3] = seg[..., :3] * a + dst[..., :3] * (1 - a)
        dst[..., 3:4] = seg[..., 3:4] + dst[..., 3:4] * (1 - a)
    top = im; a = top[..., 3:4] / 255.0; base = out[:h]
    base[..., :3] = top[..., :3] * a + base[..., :3] * (1 - a)
    base[..., 3:4] = top[..., 3:4] + base[..., 3:4] * (1 - a)
    out[:h] = base
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(ART, name[3:] + '_Long.png'))


def ring_front():
    """Registry ring threads through the tag's eyelet: the full ring sits BEHIND the tag (visible outside it and through
    the hole); this piece is only its part above the hole's centre line, drawn IN FRONT, so the ring crosses over the
    eyelet's top rim into the hole. The seam lies inside the (transparent) hole, so it never shows."""
    P = {p['name']: p for p in json.load(open(os.path.join(HERE, 'placement.json')))['Registry_Name']}
    r, t = P['Registry_Name_Ring'], P['Registry_Name_Tag']
    tag = np.asarray(Image.open(os.path.join(A, t['file'])).convert('RGBA'))[..., 3] > 128
    from scipy import ndimage as nd
    lab, n = nd.label(~tag)
    holes = [i for i in range(1, n + 1) if 30 < (lab == i).sum() < 20000 and not (lab == i)[0].any() and not (lab == i)[:, 0].any()]
    ys, xs = np.nonzero(lab == holes[0])
    hole = [t['x'] + xs.mean() * t['s'], t['y'] + ys.mean() * t['s']]
    im = np.asarray(Image.open(os.path.join(A, r['file'])).convert('RGBA')).astype(np.float32)
    yy = np.arange(im.shape[0], dtype=np.float32)[:, None]
    cut = (hole[1] - r['y']) / r['s']                      # hole centre line in ring-PNG px
    im[..., 3] *= np.clip((cut - yy) / 3.0 + 0.5, 0, 1)    # 3 px feather
    Image.fromarray(im.astype(np.uint8)).save(os.path.join(ART, 'Registry_Name_Ring_Front.png'))
    json.dump({'hole': hole}, open(os.path.join(HERE, 'registry_hole.json'), 'w'))


def enclosed_holes(alpha):
    """Transparent regions fully enclosed by the part (eyelets, punch holes): [(mask, cx, cy)] in PNG px."""
    from scipy import ndimage as nd
    lab, n = nd.label(~alpha)
    out = []
    for i in range(1, n + 1):
        m = lab == i
        if 20 < m.sum() < 20000 and not (m[0].any() or m[-1].any() or m[:, 0].any() or m[:, -1].any()):
            ys, xs = np.nonzero(m); out.append((m, float(xs.mean()), float(ys.mean())))
    return out


CALENDARS = {'Date': ('03_Date/01_Date_Calendar.png', ['Date_Ring_Left', 'Date_Ring_Right']),
             'Due_Date': ('05_Due_Date/01_Due_Date_Calendar.png', ['Due_Date_Ring_Left', 'Due_Date_Ring_Right'])}


def calendar_rings():
    """Binder rings go INTO the calendar's punch holes. The regenerated calendars have see-through holes; the originals
    have dark ones. Holes get a dark interior (art/<cal>_Holes.png), and each ring gets a front piece = its part above
    its hole's centre line (art/<ring>_Front.png); the full ring sits behind the calendar."""
    from scipy import ndimage as nd
    P = json.load(open(os.path.join(HERE, 'placement.json')))
    holes_out = {}
    for icon, (cal, rings) in CALENDARS.items():
        pl = {p['name']: p for p in P[icon]}; c = pl[icon + '_Calendar']
        im = np.asarray(Image.open(os.path.join(A, cal)).convert('RGBA')).astype(np.float32)
        hs = enclosed_holes(im[..., 3] > 128)
        for m, hx, hy in hs:
            # dark interior, lighter toward the bottom-front edge, 1 px soft rim
            dist = nd.distance_transform_edt(m)
            yy = np.nonzero(m)[0]
            shade = 34 + 30 * np.clip((np.arange(im.shape[0])[:, None] - yy.min()) / max(1, yy.max() - yy.min()), 0, 1)
            a = np.clip(dist, 0, 1.5) / 1.5
            for ch in range(3):
                im[..., ch] = np.where(m, im[..., ch] * (1 - a) + (shade * 0.95 if ch < 2 else shade) * a, im[..., ch])
            im[..., 3] = np.where(m, 255.0, im[..., 3])
        Image.fromarray(im.astype(np.uint8)).save(os.path.join(ART, icon + '_Calendar_Holes.png'))
        comp_holes = [[c['x'] + hx * c['s'], c['y'] + hy * c['s']] for _, hx, hy in hs]
        for rn in rings:
            r = pl[rn]
            rim = np.asarray(Image.open(os.path.join(A, r['file'])).convert('RGBA')).astype(np.float32)
            rcx = r['x'] + rim.shape[1] * r['s'] / 2
            hi = min(range(len(hs)), key=lambda q: abs(comp_holes[q][0] - rcx))
            hole = comp_holes[hi]; hm = hs[hi][0]
            # cut along the hole's FRONT (lower) rim: the ring shows going down into the dark hole and vanishes behind
            # its lip. Per ring column: the hole's lowest row there (calendar px -> comp -> ring px); outside the hole's
            # columns, the hole's lowest row overall.
            # Outside the hole's columns the strand is the ring's BACK strand: it goes over the calendar's top edge and
            # behind it, so it is cut at the calendar's top edge in that column.
            hys, hxs = np.nonzero(hm)
            cal_a = im[..., 3] > 128
            cut = np.full(rim.shape[1], 0.0, np.float32)
            for xr in range(rim.shape[1]):
                xc = (r['x'] + xr * r['s'] - c['x']) / c['s']
                col = hys[np.abs(hxs - xc) < 0.5]
                if len(col):
                    cut[xr] = (c['y'] + (col.max() + 0.5) * c['s'] - r['y']) / r['s'] - 1.0 / r['s']
                else:
                    xi = int(round(xc))
                    top = np.nonzero(cal_a[:, xi])[0] if 0 <= xi < cal_a.shape[1] else []
                    cut[xr] = (c['y'] + top.min() * c['s'] - r['y']) / r['s'] + 1.0 / r['s'] if len(top) else rim.shape[0]
            yy = np.arange(rim.shape[0], dtype=np.float32)[:, None]
            rim[..., 3] *= np.clip((cut[None, :] - yy) / 3.0 + 0.5, 0, 1)
            Image.fromarray(rim.astype(np.uint8)).save(os.path.join(ART, rn + '_Front.png'))
            holes_out[rn] = hole
    json.dump(holes_out, open(os.path.join(HERE, 'calendar_holes.json'), 'w'), indent=1)


def helpers(path):
    a = np.asarray(Image.open(path).convert('RGBA'))[..., 3] > 128
    ys, xs = np.nonzero(a)
    t, b, l, r = ys.min(), ys.max(), xs.min(), xs.max()
    band = ys >= b - max(3, (b - t) * 0.06)          # lowest 6 %: the base / tip a part grows from
    return {'w': int(a.shape[1]), 'h': int(a.shape[0]), 'l': int(l), 't': int(t), 'r': int(r), 'b': int(b),
            'base': [float(xs[band].mean()), float(b)], 'c': [float((l + r) / 2), float((t + b) / 2)]}


def main():
    canister_front()
    ring_front()
    calendar_rings()
    out = {}
    for d in sorted(os.listdir(A)):
        p = os.path.join(A, d)
        if os.path.isdir(p) and d[:2].isdigit():
            for f in sorted(os.listdir(p)):
                if f.endswith('.png'):
                    out[d + '/' + f] = helpers(os.path.join(p, f))
    out['art/Occasion_Canister_Front.png'] = helpers(os.path.join(ART, 'Occasion_Canister_Front.png'))
    for s in SPRAYS:
        spray_long(s)
        out['art/' + s[3:] + '_Long.png'] = helpers(os.path.join(ART, s[3:] + '_Long.png'))
    json.dump(out, open(os.path.join(HERE, 'bboxes.json'), 'w'), indent=1)
    print(len(out), 'parts')


if __name__ == '__main__':
    main()
