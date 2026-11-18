#!/usr/bin/env python3
"""Key the element sheet (Figma 890:194708: pieces on a PAINTED checkerboard) and place each piece where the
composed hero picture (gift_3x.png, Figma 843:763450 at 3x) has it, by masked template matching over scale + rotation.

    python3 pieces_match.py  ->  ../figma/pieces/<name>.png (keyed, at sheet res) + ../figma/pieces/match.json"""
import json, os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__)); FIG = os.path.join(os.path.dirname(HERE), 'figma')
OUT = os.path.join(FIG, 'pieces'); os.makedirs(OUT, exist_ok=True)
S = np.asarray(Image.open(os.path.join(FIG, 'sheet_raw1.png')).convert('RGB')).astype(np.float32)
mx, mn = S.max(2), S.min(2); sat = (mx - mn) / np.maximum(mx, 1)

# ---- background model: neutral pixels in the two checker bands ----
bright = (sat < 0.06) & (mx > 238); mid = (sat < 0.06) & (mx > 196) & (mx < 224)
bglike = bright | mid
lab, n = ndimage.label(bglike)
objs = ndimage.find_objects(lab)
bg = np.zeros(bglike.shape, bool)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
for i in range(n):
    o = objs[i]; m = lab[o] == i + 1; a = m.sum()
    if i + 1 in border: bg[o] |= m; continue
    # an enclosed region is real background when it is checker: both bands present (a highlight is one band)
    if a > 60:
        b1 = (bright[o] & m).sum() / a; b2 = (mid[o] & m).sum() / a
        if min(b1, b2) > 0.18: bg[o] |= m
# the checker squares are separate regions (bright and mid cells touch only at corners): merge by closing
bg = ndimage.binary_closing(bg, structure=np.ones((3, 3)), iterations=2) & bglike | bg
fg = ndimage.binary_opening(~bg, iterations=1)
lab2, n2 = ndimage.label(fg); o2 = ndimage.find_objects(lab2); ar2 = [(lab2[o] == i + 1).sum() for i, o in enumerate(o2)]
keep = np.zeros(fg.shape, bool)
for i in range(n2):
    if ar2[i] > 300: keep |= lab2 == i + 1
alpha = cv2.GaussianBlur(ndimage.binary_erosion(keep, iterations=1).astype(np.float32), (0, 0), 0.7)

# un-mix the light checker from edge pixels: c = a F + (1 - a) B, B ~ local checker grey (230)
A3 = alpha[..., None]
F = np.where(A3 > 0.05, (S - (1 - A3) * 232.0) / np.maximum(A3, 0.05), S)
F = np.clip(F, 0, 255)
RGBA = np.dstack([F, alpha * 255]).astype(np.uint8)

# ---- the pieces (sheet boxes found by saturation + the keyed silhouettes) ----
satm = sat > 0.10
sl, sn = ndimage.label(satm); so = ndimage.find_objects(sl); sa = [(sl[o] == i + 1).sum() for i, o in enumerate(so)]
def sat_piece(x0, y0):   # the saturated component containing (x0, y0)
    return sl == sl[y0, x0]
heart_big = ndimage.binary_fill_holes(ndimage.binary_dilation(sat_piece(250, 260), iterations=6)) & keep
heart_small = ndimage.binary_fill_holes(ndimage.binary_dilation(sat_piece(430, 470), iterations=6)) & keep
lid = keep.copy(); lid[:, :300] = False; lid[:, 1180:] = False; lid[:60, :] = False; lid[760:, :] = False
lid &= ~ndimage.binary_dilation(heart_small | heart_big, iterations=3)
ll, ln = ndimage.label(lid); lo = ndimage.find_objects(ll); la = [(ll[o] == i + 1).sum() for i, o in enumerate(lo)]
lid = ll == (int(np.argmax(la)) + 1)
lid = ndimage.binary_fill_holes(lid) & keep | lid

pieces = {'heart_big': heart_big, 'heart_small': heart_small, 'lid': lid}
cut = {}
for k, m in pieces.items():
    box = ndimage.find_objects(m.astype(int))[0]
    im = RGBA[box].copy(); mm = ndimage.binary_dilation(m, iterations=1)[box]
    im[..., 3] = np.where(mm, im[..., 3], 0)
    Image.fromarray(im).save(os.path.join(OUT, k + '.png'))
    cut[k] = (im, box)
    print('%-12s sheet box x%d-%d y%d-%d  %dx%d' % (k, box[1].start, box[1].stop, box[0].start, box[0].stop, im.shape[1], im.shape[0]))

# ---- match into the composed picture (459x459 at 3x) ----
C = np.asarray(Image.open(os.path.join(FIG, 'gift_3x.png')).convert('RGBA')).astype(np.float32)
Crgb = C[..., :3] * (C[..., 3:] / 255.0)        # on black
res = {}
def warp(im, s, rot):
    h, w = im.shape[:2]; M = cv2.getRotationMatrix2D((w / 2, h / 2), rot, s)
    cos, sin = abs(M[0, 0]), abs(M[0, 1]); nw, nh = int(w * cos + h * sin) + 2, int(w * sin + h * cos) + 2
    M[0, 2] += nw / 2 - w / 2; M[1, 2] += nh / 2 - h / 2
    return cv2.warpAffine(im, M, (nw, nh), flags=cv2.INTER_AREA, borderValue=(0, 0, 0, 0)), M
for k, (im, box) in cut.items():
    best = None
    imf = im.astype(np.float32)
    rng = np.arange(0.36, 0.56, 0.01) if k == 'lid' else np.arange(0.18, 0.34, 0.01)
    for s in rng:
        for rot in range(-30, 31, 3):
            t, M = warp(imf, s, rot)
            if t.shape[0] >= C.shape[0] or t.shape[1] >= C.shape[1]: continue
            a = t[..., 3:] / 255.0; trgb = (t[..., :3] * a).astype(np.float32)
            mask = np.repeat((a > 0.6).astype(np.float32), 3, axis=2)
            if mask.sum() < 300: continue
            r = cv2.matchTemplate(Crgb, trgb, cv2.TM_SQDIFF, mask=mask)
            v, _, loc, _ = cv2.minMaxLoc(r)
            v /= mask.sum()
            if best is None or v < best[0]: best = (v, s, rot, loc)
    v, s, rot, loc = best
    # refine
    for s2 in np.arange(s - 0.01, s + 0.0101, 0.0025):
        for r2 in np.arange(rot - 3, rot + 3.01, 0.5):
            t, M = warp(imf, s2, r2)
            a = t[..., 3:] / 255.0; trgb = (t[..., :3] * a).astype(np.float32)
            mask = np.repeat((a > 0.6).astype(np.float32), 3, axis=2)
            rr = cv2.matchTemplate(Crgb, trgb, cv2.TM_SQDIFF, mask=mask); vv, _, ll2, _ = cv2.minMaxLoc(rr); vv /= mask.sum()
            if vv < best[0]: best = (vv, s2, r2, ll2)
    v, s, rot, loc = best
    t, M = warp(imf, s, rot)
    res[k] = {'scale': round(float(s), 4), 'rot': round(float(rot), 2), 'x': int(loc[0]), 'y': int(loc[1]), 'w': t.shape[1], 'h': t.shape[0], 'err': round(float(np.sqrt(v)), 2)}
    Image.fromarray(np.clip(t, 0, 255).astype(np.uint8)).save(os.path.join(OUT, k + '_placed.png'))
    print('%-12s scale %.4f rot %+.1f at (%d, %d) size %dx%d  rms err %.1f' % (k, s, rot, loc[0], loc[1], t.shape[1], t.shape[0], np.sqrt(v)))
json.dump(res, open(os.path.join(OUT, 'match.json'), 'w'), indent=1)
