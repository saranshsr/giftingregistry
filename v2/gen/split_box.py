#!/usr/bin/env python3
"""Split the composed v2 gift picture (gift_3x.png, 459x459 = Figma 843:763450 at 3x) into layers that can move:
lid, two hearts, box back (inner glow + back wall), box front (front wall + gem). Hearts are cut by the outlines of the
keyed sheet pieces matched into the picture (pieces_match.py); what they covered on the lid and the glow is filled
from the surroundings. Star + sparkle pieces are already cut by prep_art.py and are removed here too.

    python3 split_box.py  ->  ../figma/split/*.png + split.json (offsets in the 459 canvas) + check.png"""
import json, os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
FIG = os.path.join(ROOT, 'figma'); OUT = os.path.join(FIG, 'split'); os.makedirs(OUT, exist_ok=True)
C = np.asarray(Image.open(os.path.join(FIG, 'gift_3x.png')).convert('RGBA')).astype(np.float32)
a = C[..., 3]; H, W = a.shape
M = json.load(open(os.path.join(FIG, 'pieces', 'match.json')))
ART = json.load(open(os.path.join(ROOT, 'art', 'art.json')))
GX, GY = 99 * 3, 28 * 3                       # the picture's top-left in the comp

def placed_alpha(k):
    t = np.asarray(Image.open(os.path.join(FIG, 'pieces', k + '_placed.png'))).astype(np.float32)[..., 3] / 255.0
    m = M[k]; out = np.zeros((H, W), np.float32)
    y0, x0 = m['y'], m['x']; h, w = t.shape
    out[y0:y0 + h, x0:x0 + w] = t[:min(h, H - y0), :min(w, W - x0)]
    return out

# pieces already cut elsewhere (stars, sparkles): remove them from the picture
other = np.zeros((H, W), bool)
for k in ['star_green', 'star_grey'] + ART['spark_keys']:
    p = ART[k]; im = np.asarray(Image.open(os.path.join(ROOT, 'art', p['file'])).convert('RGBA'))[..., 3] > 0
    x0, y0 = int(round(p['x'] - GX)), int(round(p['y'] - GY)); h, w = im.shape
    other[y0:y0 + h, x0:x0 + w] |= im

# hearts: the picture's own pixels inside the matched outlines (so the rest frame is exact)
layers = {}
heart_any = np.zeros((H, W), bool)
for k in ('heart_big', 'heart_small'):
    pa = placed_alpha(k)
    hm = cv2.GaussianBlur((pa > 0.5).astype(np.float32), (0, 0), 0.6)
    hm = np.maximum(hm, (pa > 0.5).astype(np.float32))
    L = C.copy(); L[..., 3] = np.minimum(a, hm * 255)
    layers[k] = L; heart_any |= pa > 0.15

rest = (a > 0) & ~other
hole = ndimage.binary_dilation(heart_any, iterations=5)   # wide enough to take the hearts' cyan rim glow
body = rest & ~hole
lab, n = ndimage.label(body & (a > 20)); objs = ndimage.find_objects(lab)
areas = [(lab[o] == i + 1).sum() for i, o in enumerate(objs)]
order = sorted(range(n), key=lambda i: -areas[i])
box_i, lid_i = sorted(order[:2], key=lambda i: -objs[i][0].start)   # lower one is the box
box_core = lab == box_i + 1; lid_core = lab == lid_i + 1
# soft/low-alpha pixels (glow, edges) go to the nearer of the two
dist_box = ndimage.distance_transform_edt(~box_core); dist_lid = ndimage.distance_transform_edt(~lid_core)
box_m = body & (dist_box <= dist_lid); lid_m = body & (dist_lid < dist_box)

def fill(mask_obj, hole_m, close_px, hull=False):
    """Fill the part of the hole that lies inside the object's closed silhouette, colour + alpha from the surroundings."""
    sil = ndimage.binary_closing(mask_obj, structure=np.ones((3, 3)), iterations=close_px)
    if hull:                                           # convex objects (the box): fill up to the convex hull
        pts = np.argwhere(mask_obj & (a > 60))[:, ::-1].astype(np.int32)
        hm_ = np.zeros(mask_obj.shape, np.uint8); cv2.fillPoly(hm_, [cv2.convexHull(pts)], 1)
        sil |= hm_.astype(bool)
    fh = hole_m & sil
    L = C.copy(); L[..., 3] = np.where(mask_obj, a, 0)
    if fh.any():
        rgb = np.clip(C[..., :3], 0, 255).astype(np.uint8)
        known = (mask_obj & (a > 200)).astype(np.uint8)
        inp = cv2.inpaint(rgb, (~known.astype(bool)).astype(np.uint8) * 255, 15, cv2.INPAINT_TELEA)   # sources: solid object pixels only
        L[..., :3] = np.where(fh[..., None], inp, L[..., :3])
        L[..., 3] = np.where(fh, 255, L[..., 3])
        L[..., 3] = np.where(sil & ~mask_obj & ~fh, 0, L[..., 3])
    return L, int(fh.sum())

lid_L, lid_fill = fill(lid_m, hole | ndimage.binary_dilation(other, iterations=2), 10, hull=True)   # also where the green star sat on the rim
box_L, box_fill = fill(box_m, hole, 14, hull=True)

# front rim: per column, the lowest bright glow pixel inside the opening; the front wall is everything below it
rgb = C[..., :3]; mx = rgb.max(2); glow = box_m & (mx > 205) & (rgb[..., 2] > rgb[..., 0] + 6)
glow[:200] = False; glow[300:] = False
xs = np.arange(W); edge = np.full(W, np.nan)
for x in range(W):
    ys = np.where(glow[:, x])[0]
    if len(ys) > 3: edge[x] = ys.max()
valid = ~np.isnan(edge)
ex = xs[valid]; ey = edge[valid]
# robust polyline: the rim is two straight edges meeting at the front corner (lowest point)
fx = ex[np.argmax(ey)]
def fitline(sel):
    return np.polyfit(ex[sel], ey[sel], 1) if sel.sum() > 5 else None
lft = fitline((ex < fx) & (ex > ex.min() + 6)); rgt = fitline((ex > fx) & (ex < ex.max() - 6))
rim = np.full(W, -1.0)
for x in range(W):
    if lft is not None and x <= fx: rim[x] = np.polyval(lft, x)
    elif rgt is not None: rim[x] = np.polyval(rgt, x)
rim += 3                                               # keep the chrome lip with the front wall
yy = np.arange(H)[:, None]
front = (yy > rim[None, :]) & (box_L[..., 3] > 0) & (yy > 230)
box_front = box_L.copy(); box_front[..., 3] = np.where(front, box_L[..., 3], 0)
box_back = box_L.copy(); box_back[..., 3] = np.where(front, 0, box_L[..., 3])
layers.update({'lid': lid_L, 'box_back': box_back, 'box_front': box_front})

info = {'canvas': [W, H], 'origin_comp': [GX, GY], 'front_corner': [int(fx), float(np.max(ey))],
        'rim_left': [float(v) for v in lft] if lft is not None else None, 'rim_right': [float(v) for v in rgt] if rgt is not None else None,
        'filled_px': {'lid': lid_fill, 'box': box_fill}}
for k, L in layers.items():
    L8 = np.clip(L, 0, 255).astype(np.uint8)
    bb = Image.fromarray(L8).getbbox()
    Image.fromarray(L8).crop(bb).save(os.path.join(OUT, k + '.png'))
    info[k] = {'x': bb[0], 'y': bb[1], 'w': bb[2] - bb[0], 'h': bb[3] - bb[1]}
    # hearts overlapping the front wall at rest would be hidden by it: report
    if k.startswith('heart'): info[k]['under_front_px'] = int(((L[..., 3] > 40) & front).sum())
json.dump(info, open(os.path.join(OUT, 'split.json'), 'w'), indent=1)

# check: re-stack (back, hearts, front, lid, others) and compare to the original
st = np.zeros((H, W, 4), np.float32)
def over(dst, src):
    sa = src[..., 3:] / 255.0; da = dst[..., 3:] / 255.0; oa = sa + da * (1 - sa)
    rgbo = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.dstack([rgbo, oa * 255])
for k in ('box_back', 'heart_big', 'heart_small', 'box_front', 'lid'): st = over(st, layers[k])
orig = C.copy(); orig[..., 3] = np.where(other, 0, a)
pa_, pb_ = st[..., :3] * st[..., 3:] / 255, orig[..., :3] * orig[..., 3:] / 255
e = np.abs(np.concatenate([pa_ - pb_, st[..., 3:] - orig[..., 3:]], 2)).mean(2)
print(json.dumps({k: v for k, v in info.items() if k in ('front_corner', 'filled_px')}),
      '| hearts under front wall px:', info['heart_big']['under_front_px'], info['heart_small']['under_front_px'])
print('restack vs original: mean %.2f p99.5 %.1f max %.1f' % (e.mean(), np.percentile(e, 99.5), e.max()))
Image.fromarray(np.clip(st, 0, 255).astype(np.uint8)).save(os.path.join(OUT, 'check.png'))
