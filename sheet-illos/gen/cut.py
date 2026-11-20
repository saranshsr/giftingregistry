#!/usr/bin/env python3
"""Cut the two flat sheet illustrations (../art/<card>_full.png, 600x360 = Visuals box at 3x) into moving pieces.

Two kinds of piece:
  cut   - the piece's pixels leave the base; what was behind is inpainted inside the object's silhouette
          (transparent where only the card background was behind), so the piece can travel.
  copy  - an exact copy of base pixels laid on top (the base keeps them). Only ever scaled >= 100% about an anchor
          inside it, so the copy always covers its own original and nothing behind it has to be invented.
Pieces that sit BEHIND the base (ribbons) are cut and carry an inpainted extension under whatever covers their ends.
The rest pose restacks to the Figma picture (checked at the end, numbers printed).

    python3 cut.py  ->  ../art/pieces/<card>/*.png + pieces.json, ../art/pieces/<card>_restack.png"""
import json, os, sys
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from masks import poly, disc, hsv, component_at, grow_into, fill_holes

ART = os.path.join(ROOT, 'art'); OUTR = os.path.join(ART, 'pieces'); os.makedirs(OUTR, exist_ok=True)
PREP = json.load(open(os.path.join(ART, 'prep.json')))


def load(p): return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32)


def over(dst, src):
    sa = src[..., 3:] / 255.0; da = dst[..., 3:] / 255.0; oa = sa + da * (1 - sa)
    rgb = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.dstack([rgb, oa * 255])


def inpaint_from(C, known, todo, radius=6):
    """Telea fill of `todo` pixels using only `known` pixels as sources."""
    rgb = np.clip(C[..., :3], 0, 255).astype(np.uint8)
    unknown = (~known).astype(np.uint8) * 255
    return cv2.inpaint(rgb, unknown, radius, cv2.INPAINT_TELEA).astype(np.float32)


class Card:
    def __init__(self, name):
        self.name = name
        self.C = load(os.path.join(ART, name + '_full.png'))
        self.a = self.C[..., 3]; self.sh = self.a.shape
        self.base = self.C.copy()
        self.layers = []          # (name, rgba full canvas, meta) bottom -> top, base inserted by name 'base'
        self.H, self.S, self.V = hsv(self.C[..., :3])

    def take(self, m):
        """piece = original pixels in m (hard mask); removes them from the base."""
        P = self.C.copy(); P[..., 3] = np.where(m, self.a, 0)
        self.base[..., 3] = np.where(m, 0, self.base[..., 3])
        return P

    def fill_hole(self, hole, support, darken=1.0, radius=8):
        """inside `support`, give the base back opaque pixels in the hole (colour from the remaining base)."""
        fh = hole & support & (self.a > 250)      # soft edges against the card background keep nothing behind them
        if not fh.any(): return 0
        known = (self.base[..., 3] > 200)
        inp = inpaint_from(self.base, known, fh, radius)
        self.base[..., :3] = np.where(fh[..., None], inp * darken, self.base[..., :3])
        self.base[..., 3] = np.where(fh, np.maximum(self.base[..., 3], 253), self.base[..., 3])
        return int(fh.sum())

    def extend(self, P, own, region, radius=6):
        """grow piece P into `region` with colours from its own pixels (for parts hidden under something)."""
        known = own & (P[..., 3] > 200)
        inp = inpaint_from(P, known, region, radius)
        Q = P.copy()
        Q[..., :3] = np.where(region[..., None], inp, Q[..., :3]); Q[..., 3] = np.where(region, 253, Q[..., 3])
        return Q

    def add(self, name, P, **meta): self.layers.append((name, P, meta))

    def write(self, sparkles=()):
        od = os.path.join(OUTR, self.name); os.makedirs(od, exist_ok=True)
        info = {'canvas': [self.sh[1], self.sh[0]], 'layers': []}
        st = np.zeros(self.sh + (4,), np.float32)
        for nm, P, meta in self.layers:
            if nm == 'base': P = self.base
            Pr = P.copy()
            if 'opacity' in meta: Pr[..., 3] *= meta['opacity']
            st = over(st, Pr)
            L8 = np.clip(P + 0.5, 0, 255).astype(np.uint8)
            L8[..., :3] = np.where(L8[..., 3:] == 0, 0, L8[..., :3])
            bb = Image.fromarray(L8).getbbox()
            fn = '%s_%s.png' % (self.name, nm)
            Image.fromarray(L8).crop(bb).save(os.path.join(od, fn))
            info['layers'].append(dict({'name': nm, 'file': fn, 'x': bb[0], 'y': bb[1], 'w': bb[2] - bb[0], 'h': bb[3] - bb[1]}, **meta))
        ref = self.C.copy()
        for sp, op in sparkles:
            q = sp.copy(); q[..., 3] *= op; ref = over(ref, q)
        pa, pb = st[..., :3] * st[..., 3:] / 255, ref[..., :3] * ref[..., 3:] / 255
        e = np.abs(np.concatenate([pa - pb, st[..., 3:] - ref[..., 3:]], 2)).max(2)
        info['restack'] = {'mean': round(float(e.mean()), 3), 'p99_9': round(float(np.percentile(e, 99.9)), 2), 'max': round(float(e.max()), 2)}
        json.dump(info, open(os.path.join(od, 'pieces.json'), 'w'), indent=1)
        Image.fromarray(np.clip(st + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(OUTR, self.name + '_restack.png'))
        print(self.name, 'restack vs Figma picture (max channel diff, 0-255):', info['restack'])
        return info


# ------------------------------------------------------------------ collection (basket)
def collection():
    K = Card('collection'); C, a, sh, H, S, V = K.C, K.a, K.sh, K.H, K.S, K.V
    purple = (H > 245) & (H < 300) & (S > 0.22) & (a > 10)
    # star + three dashes: free-floating components (nothing behind them)
    star = component_at(a > 20, [(455, 80)])
    dashes = [component_at(a > 20, [p]) for p in ((482, 112), (497, 130), (503, 149))]
    region = poly([(425, 40), (540, 40), (540, 165), (425, 165)], sh)
    star_m = grow_into(star, a, 3) & region
    dash_m = []
    for d in dashes:                                   # mutually exclusive, so no pixel is drawn twice
        m = grow_into(d, a, 3) & region & ~star_m
        for q in dash_m: m &= ~q
        dash_m.append(m)
    # ribbons: lavender (+ its white speculars) outside the basket, inside a hand-drawn zone per side
    wh = (S < 0.2) & (V > 0.9) & (a > 10)
    rib = purple | (wh & ndimage.binary_dilation(purple, iterations=5))
    rib = ndimage.binary_closing(rib, iterations=2) & (a > 0)
    PL = [(205, 90), (345, 90), (345, 118), (320, 128), (290, 138), (262, 158), (248, 185), (252, 200), (238, 215), (205, 215)]
    PR = [(432, 150), (452, 138), (545, 150), (545, 270), (500, 272), (488, 238), (468, 200), (445, 186)]
    lamp_zone = poly([(319, 40), (436, 40), (440, 108), (442, 118), (400, 128), (396, 140), (394, 150), (394, 170), (366, 170),
                      (366, 150), (362, 136), (352, 131), (340, 129), (326, 126), (319, 124)], sh)
    rl = rib & poly(PL, sh) & ~lamp_zone
    rr = rib & poly(PR, sh)
    free = ~(star_m | dash_m[0] | dash_m[1] | dash_m[2])
    rl = grow_into(rl, a, 1) & ~lamp_zone & free; rr = grow_into(rr, a, 1) & free
    # lamp (dome + stem) and heart badge: copies on top
    lamp = lamp_zone & (a > 0) & ~ndimage.binary_dilation(purple, iterations=1) & ~star_m
    badge = disc(466.5, 243.5, 33.5, sh) | disc(464, 248, 32.5, sh)

    # crumbs: small islands that would be left in the base inside a ribbon zone belong to the ribbon
    left_over = (a > 4) & ~rl & ~rr & ~lamp_zone & ~star_m & free
    lab, n = ndimage.label(left_over)
    sizes = ndimage.sum(np.ones(sh), lab, index=np.arange(1, n + 1))
    crumbs = np.isin(lab, np.where(sizes < 400)[0] + 1)
    rl |= crumbs & poly(PL, sh); rr |= crumbs & poly(PR, sh)
    RL = K.take(rl); RR = K.take(rr)
    ST = K.take(star_m); DS = [K.take(m) for m in dash_m]
    # ribbon ends continue under whatever covers them (headphones, dome, basket, badge) so a sway never shows a cut
    cover = K.base[..., 3] > 250
    RL = K.extend(RL, rl, ndimage.binary_dilation(rl, iterations=6) & cover & ~rl)
    RR = K.extend(RR, rr, ndimage.binary_dilation(rr, iterations=6) & cover & ~rr)
    # 'copy' pieces leave a hole that is never seen: they only scale >= 100% about an inside anchor, so they always
    # cover their own footprint (taking them out of the base keeps soft edges from compositing twice)
    LP = K.take(lamp & ~rl & ~rr); BG = K.take(badge & (a > 0) & ~rl & ~rr & ~lamp)
    # dotLottie (ThorVG) draws transformed images up to ~1 px off; keep the opaque interior of the copies in the base too,
    # so a slip shows the same picture instead of a hole (only the soft rim is removed, so nothing composites twice there)
    keep = ((lamp & ~rl & ~rr) | (badge & ~rl & ~rr & ~lamp)) & (a > 250)
    K.base[..., 3] = np.where(keep, a, K.base[..., 3])

    K.add('ribbon_left', RL, pivot=[300, 165])
    K.add('ribbon_right', RR, pivot=[468, 215])
    K.add('base', None)
    K.add('lamp', LP, anchor=[380, 170], kind='copy')
    K.add('heart', BG, anchor=[466.5, 243.5], kind='copy')
    K.add('star', ST, anchor=[456, 82])
    for k, D in enumerate(DS): K.add('dash%d' % (k + 1), D)
    return K.write()


# ------------------------------------------------------------------ registry (gift box)
def registry():
    K = Card('registry'); C, a, sh, H, S, V = K.C, K.a, K.sh, K.H, K.S, K.V
    pink = ((H > 300) | (H < 20)) & (S > 0.18) & (a > 10)
    heart = fill_holes(component_at(ndimage.binary_closing(pink, iterations=2), [(300, 180)]))
    heart_m = grow_into(heart, a, 1)
    dashes = [component_at(a > 20, [p]) for p in ((484, 108), (495, 120), (498, 134))]
    dash_m = []
    for d in dashes:
        m = grow_into(d, a, 3) & poly([(462, 85), (520, 85), (520, 146), (462, 146)], sh)
        for q in dash_m: m &= ~q
        dash_m.append(m)
    badge_m = disc(498.5, 178.5, 38.5, sh) & (a > 0)
    for d in dash_m: badge_m &= ~d
    CARD = [(344.5, 175), (344.5, 138), (346, 132), (349, 128), (353, 125.5), (360, 123.5), (370, 121.5), (380, 120.5), (400, 119.5),
            (420, 118.5), (430, 117.5), (440, 119.5), (447, 122), (452, 126), (456, 131), (457, 175)]
    card = poly(CARD, sh)
    LID = [(292, 40), (472, 40), (472, 124), (457, 131)] + CARD[1:-1][::-1] + [(344.5, 160), (330, 168), (296, 168)]
    lid_m = poly(LID, sh) & (a > 0) & ~ndimage.binary_dilation(heart_m, iterations=1)
    for d in dash_m: lid_m &= ~d

    HT = K.take(heart_m); BD = K.take(badge_m); DS = [K.take(m) for m in dash_m]; LD = K.take(lid_m)
    # under the lid: the box interior, only in a band above the card (the lid's face); in shadow
    ys = np.arange(sh[0])[:, None]; xs = np.arange(sh[1])[None, :]
    under = (ys > 112) & (xs >= 344) & (xs <= 470)       # left of the card the lid hangs in the air
    # plus a 3 px strip wherever the lid borders the rest of the box/card (a ThorVG 1 px slip must not open a seam)
    near = ndimage.binary_dilation(K.base[..., 3] > 250, iterations=3) & (np.arange(sh[1])[None, :] >= 340)   # card side only
    nl = K.fill_hole(lid_m, (under & ~poly([(292, 40), (472, 40), (472, 96), (292, 96)], sh)) | near, darken=0.55)
    # behind heart and badge: whatever of the box/ribbon closes over them
    rest = K.base[..., 3] > 60
    sil = ndimage.binary_closing(rest, structure=np.ones((3, 3)), iterations=10)
    # behind the heart: the ribbon loop and the box's top-left corner run on under it. Fill inside the convex hull of
    # what is left around it (ribbon, box, card); the heart's upper-left lobe hangs over the card background and stays empty.
    win = np.zeros(sh, bool); win[135:235, 235:365] = True
    pts = np.argwhere(win & (K.base[..., 3] > 200))[:, ::-1].astype(np.int32)
    hull = np.zeros(sh, np.uint8); cv2.fillPoly(hull, [cv2.convexHull(pts)], 1)
    nh = K.fill_hole(ndimage.binary_dilation(heart_m, iterations=1), sil | hull.astype(bool), radius=10)
    nb = K.fill_hole(badge_m, sil)
    # the lid continues a little under the card (so a lift never shows its cut), the card is laid back on top
    CD = C.copy(); CD[..., 3] = np.where(card & (np.arange(sh[0])[:, None] < 175) & (a > 250), a, 0)
    LD = K.extend(LD, lid_m, ndimage.binary_dilation(lid_m, iterations=10) & card & (CD[..., 3] > 250))
    # ...and its curled left end continues under the heart (the heart sits in front of it)
    ys_ = np.arange(sh[0])[:, None]
    LD = K.extend(LD, lid_m, ndimage.binary_dilation(lid_m, iterations=14) & ndimage.binary_dilation(heart_m, iterations=1)
                  & (ys_ < 172) & ~(LD[..., 3] > 0) & (HT[..., 3] > 250))

    sp = []
    for k in (1, 2):
        s = PREP['sparkle%d' % k]; im = load(os.path.join(ART, 'registry_sparkle%d.png' % k))
        F = np.zeros(sh + (4,), np.float32); F[s['y']:s['y'] + s['h'], s['x']:s['x'] + s['w']] = im
        sp.append(F)
    print('registry filled px: lid %d heart %d badge %d' % (nl, nh, nb))
    K.add('base', None)
    K.add('lid', LD, pivot=[346, 135])
    K.add('card', CD, kind='copy')
    K.add('heart', HT, anchor=[310, 199])
    K.add('badge', BD, anchor=[498.5, 178.5])
    for k, D in enumerate(DS): K.add('dash%d' % (k + 1), D)
    for k, F in enumerate(sp): K.add('sparkle%d' % (k + 1), F, opacity=PREP['sparkle%d' % (k + 1)]['opacity'])
    return K.write(sparkles=[(F, PREP['sparkle%d' % (k + 1)]['opacity']) for k, F in enumerate(sp)])


if __name__ == '__main__':
    collection(); registry()
