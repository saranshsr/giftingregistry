#!/usr/bin/env python3
"""Cut and optimise the Gift Registry hero art for the AE comp (3x, comp origin = card top-left at Figma (12, 28)).

Writes art/*.png and art/art.json (placement table in comp px: top-left x, y, layer scale %, size)."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FIG = os.path.join(ROOT, 'figma')
ART = os.path.join(ROOT, 'art')
os.makedirs(ART, exist_ok=True)
sys.path.insert(0, os.path.expanduser('~/Downloads/nano-ae-motion/scripts'))
from svgpath import parse_d

K = 3.0                     # px per Figma pt
OX, OY = 12.0, 28.0         # comp origin in Figma frame pt
W, H = int(351 * K), int(172 * K)   # 1053 x 516
cx = lambda x: (x - OX) * K
cy = lambda y: (y - OY) * K
art = {'comp': [W, H]}


def err(a, b):
    a = np.asarray(a.convert('RGBA'), float); b = np.asarray(b.convert('RGBA'), float)
    pa = a[..., :3] * a[..., 3:] / 255; pb = b[..., :3] * b[..., 3:] / 255   # premultiplied
    e = np.abs(np.concatenate([pa - pb, (a[..., 3:] - b[..., 3:])], axis=2)).mean(axis=2)
    return e.mean(), np.percentile(e, 99.5)


def save(im, name, quant=True):
    """Palette-quantise when it passes the house check (mean <= 2, p99.5 <= 32), else keep RGBA."""
    p = os.path.join(ART, name)
    im.save(p, optimize=True); full = os.path.getsize(p); note = 'rgba'
    if quant:
        q = im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        m, p99 = err(im, q)
        oa = np.asarray(im.convert('RGBA'))[..., 3]; qa = np.asarray(q.convert('RGBA'))[..., 3]
        leak = int(qa[oa == 0].max()) if (oa == 0).any() else 0          # alpha appearing where it was clear
        aerr = np.abs(oa.astype(int) - qa.astype(int)).max()
        if m <= 2 and p99 <= 32 and leak == 0 and aerr <= 24:
            q.save(p, optimize=True); note = 'pal mean %.2f p99.5 %.1f' % (m, p99)
        else:
            im.save(p, optimize=True); note = 'rgba (pal failed: mean %.2f p99.5 %.1f leak %d alpha %d)' % (m, p99, leak, aerr)
    print('%-22s %4dx%-4d %6.1f KB  %s' % (name, im.width, im.height, os.path.getsize(p) / 1024, note))


def place(key, file, x, y, w, h, scale=100.0):
    art[key] = {'file': file, 'x': round(x, 2), 'y': round(y, 2), 'w': w, 'h': h, 'scale': scale}


# ---- background: three layers from the 3x rescaled clones (clone box = Figma (0,-54) 375x235) ----
crop = (int(12 * K), int((28 + 54) * K), int(363 * K), int((181 + 54) * K))      # card region 351x153 pt
bg_h = crop[3] - crop[1]
base = Image.open(os.path.join(FIG, 'ss_base.png')).convert('RGBA').crop(crop)
waves = Image.open(os.path.join(FIG, 'ss_waves.png')).convert('RGBA').crop(crop)
fade = Image.open(os.path.join(FIG, 'ss_fade.png')).convert('RGBA').crop(crop)
# smooth layers stored small and scaled up in AE (base 1/4, fade 1/4, blurred waves 1/2)
for im, name, f in ((base, 'gr_bg_base.png', 4), (fade, 'gr_bg_fade.png', 4), (waves, 'gr_bg_waves.png', 4)):
    sm = im.resize((im.width // f, im.height // f), Image.LANCZOS)
    m, p99 = err(im, sm.resize(im.size, Image.BILINEAR))
    print('  %s downscale 1/%d check: mean %.2f p99.5 %.1f' % (name, f, m, p99))
    save(sm, name, quant=(name != 'gr_bg_base.png'))
    place(name[3:-4], name, 0, 0, sm.width, sm.height, 100.0 * f)
art['bg_h'] = bg_h
art['corner_r'] = 24 * K

# ---- gift: the visible cutout fill (raw3, 1376x768) FILLs the 275x153 node at (53.5, 40) ----
g = Image.open(os.path.join(FIG, 'raw3.png')).convert('RGBA')
s = 275.0 / g.width                       # pt per source px (FILL: width-bound, height crops 0.25 pt)
gy0 = 40.0 - (g.height * s - 153.0) / 2
S3 = s * K
G = g.resize((round(g.width * S3), round(g.height * S3)), Image.LANCZOS)
gx, gyy = cx(53.5), cy(gy0)
a = np.asarray(G)[..., 3]
lab, n = ndimage.label(a > 0)
objs = ndimage.find_objects(lab)
areas = [(lab[o] == i + 1).sum() for i, o in enumerate(objs)]
order = sorted(range(n), key=lambda i: -areas[i])
box_i = order[0]
stars = sorted([i for i in order[1:] if areas[i] > 300], key=lambda i: objs[i][1].start)   # left (green), right (grey)
print('gift components:', n, 'box area', areas[box_i], 'stars', [(objs[i][1].start, areas[i]) for i in stars])
ga = np.asarray(G).copy()
star_masks = []
for nm, i in zip(('star_green', 'star_grey'), stars):
    m = ndimage.binary_dilation(lab == i + 1, iterations=2)
    sl = ndimage.find_objects(m.astype(int))[0]
    im = ga.copy(); im[..., 3] = np.where(m, im[..., 3], 0)
    piece = Image.fromarray(im[sl]); save(piece, 'gr_%s.png' % nm)
    place(nm, 'gr_%s.png' % nm, gx + sl[1].start, gyy + sl[0].start, piece.width, piece.height)
    star_masks.append(m)
bm = np.ones(a.shape, bool)
for m in star_masks: bm &= ~m
im = ga.copy(); im[..., 3] = np.where(bm, im[..., 3], 0)
B = Image.fromarray(im); bb = B.getbbox(); B = B.crop(bb)
# photo-like chrome: JPEG colour (edges bled outward so no fringe) + an alpha matte PNG
ba = np.asarray(B, float); inside = ba[..., 3] > 0
idx = ndimage.distance_transform_edt(~inside, return_distances=False, return_indices=True)
Image.fromarray(ba[..., :3][idx[0], idx[1]].astype(np.uint8)).save(os.path.join(ART, 'gr_gift_box.jpg'), quality=86)
Image.fromarray(np.dstack([np.full(inside.shape, 255, np.uint8), ba[..., 3].astype(np.uint8)]), 'LA').save(os.path.join(ART, 'gr_gift_box_a.png'), optimize=True)
J = np.asarray(Image.open(os.path.join(ART, 'gr_gift_box.jpg')).convert('RGB'), float)
e = np.abs(J * ba[..., 3:] / 255 - ba[..., :3] * ba[..., 3:] / 255).mean(axis=2)
print('%-22s %4dx%-4d %6.1f KB + matte %.1f KB  jpeg mean %.2f p99.5 %.1f' % ('gr_gift_box.jpg', B.width, B.height,
      os.path.getsize(os.path.join(ART, 'gr_gift_box.jpg')) / 1024, os.path.getsize(os.path.join(ART, 'gr_gift_box_a.png')) / 1024, e.mean(), np.percentile(e, 99.5)))
place('gift_box', 'gr_gift_box.jpg', gx + bb[0], gyy + bb[1], B.width, B.height)
place('gift_box_a', 'gr_gift_box_a.png', gx + bb[0], gyy + bb[1], B.width, B.height)
art['gift_charm'] = None

# ---- swoosh: 3x screenshot of the rescaled clone, placed by render bounds ----
sw = Image.open(os.path.join(FIG, 'ss_swoosh.png')).convert('RGBA')
save(sw, 'gr_swoosh.png')
SW_RB = (87.599609375, 87.777587890625)
place('swoosh', 'gr_swoosh.png', cx(SW_RB[0]), cy(SW_RB[1]), sw.width, sw.height)
sw_d = 'M1.72237 30.3246C28.3846 12.0577 93.7294 -10.118 141.81 47.315C145.018 29.3749 162.021 -4.30734 204.37 4.48428'
sp = parse_d(sw_d)[0]
f = lambda X, Y: (round(cx(SW_RB[0] + X), 2), round(cy(SW_RB[1] + Y), 2))
from svgpath import ae_path
art['swoosh_path'] = ae_path(sp, f)

# ---- title: glyph pieces, gradient picture, soft shadow ----
TRB = (68.630859375, 140.360107421875)
d = open(os.path.join(FIG, 'title_d.txt')).read().strip()
json.dump({'title': {'d': d, 'rb': [TRB[0], TRB[1], 237.76, 58.344]}}, open(os.path.join(HERE, 'glyphs.json'), 'w'))
json.dump({'title': {'figma_center': [OX, OY], 'comp_center': [0, 0], 'px_per_pt': K}}, open(os.path.join(HERE, 'mapping.json'), 'w'))
art['baseline_y'] = round(cy(TRB[1] + 37.64), 2)

# gradient black -> #FF578F, SVG user space (title render-bounds origin)
p1 = np.array([cx(TRB[0] + 37.3691), cy(TRB[1] + 24.6399)]); p2 = np.array([cx(TRB[0] + 135.889), cy(TRB[1] - 133.855)])
tx0, ty0, tx1, ty1 = int(cx(TRB[0])) - 4, int(cy(TRB[1])) - 4, int(cx(TRB[0] + 237.76)) + 4, int(cy(TRB[1] + 58.344)) + 4
F = 4
gw, gh = (tx1 - tx0) // F + 1, (ty1 - ty0) // F + 1
yy, xx = np.mgrid[0:gh, 0:gw]
X = tx0 + xx * F; Y = ty0 + yy * F
v = p2 - p1; t = np.clip(((X - p1[0]) * v[0] + (Y - p1[1]) * v[1]) / (v @ v), 0, 1)
c1 = np.array([0, 0, 0]); c2 = np.array([255, 87, 143])
rgb = (c1[None, None] * (1 - t[..., None]) + c2[None, None] * t[..., None]).round().astype(np.uint8)
grad = Image.fromarray(np.dstack([rgb, np.full(t.shape, 255, np.uint8)]))
save(grad, 'gr_title_grad.png', quant=False)
place('title_grad', 'gr_title_grad.png', tx0, ty0, gw, gh, 100.0 * F)

# shadow: outline (glyphs + 5 pt outside stroke) -> offset 1 pt, blur 3.5 pt, black 15 %
pad = 60
SW_, SH_ = tx1 - tx0 + 2 * pad, ty1 - ty0 + 2 * pad
SS = 2
mask = Image.new('L', (SW_ * SS, SH_ * SS), 0); dr = ImageDraw.Draw(mask)
def flatten(sp):
    pts = [sp['pts'][0]]
    for k, seg in enumerate(sp['segs']):
        p0, p3 = sp['pts'][k], sp['pts'][k + 1]
        if seg is None: pts.append(p3); continue
        c1_, c2_ = seg
        for u in np.linspace(0, 1, 12)[1:]:
            pts.append(((1-u)**3*p0[0] + 3*(1-u)**2*u*c1_[0] + 3*(1-u)*u**2*c2_[0] + u**3*p3[0],
                        (1-u)**3*p0[1] + 3*(1-u)**2*u*c1_[1] + 3*(1-u)*u**2*c2_[1] + u**3*p3[1]))
    return pts
def area(p):
    p = np.array(p); return 0.5 * np.sum(p[:, 0] * np.roll(p[:, 1], -1) - np.roll(p[:, 0], -1) * p[:, 1])
subs = [flatten(sp) for sp in parse_d(d)]
A = [area(p) for p in subs]; sgn = np.sign(A[int(np.argmax(np.abs(A)))])
for p, ar in zip(subs, A):
    if np.sign(ar) != sgn: continue                       # outer contours only (counters filled, as the outline)
    q = [((cx(TRB[0] + x) - tx0 + pad) * SS, (cy(TRB[1] + y) - ty0 + pad) * SS) for x, y in p]
    dr.polygon(q, fill=255)
mask = mask.resize((SW_, SH_), Image.LANCZOS)
dil = mask.filter(ImageFilter.MaxFilter(2 * int(5 * K) + 1))     # square-ish dilation, softened by the blur
sh = dil.filter(ImageFilter.GaussianBlur(3.5 * K))
alpha = (np.asarray(sh, float) * 0.15).round().astype(np.uint8)
shadow = Image.fromarray(np.dstack([np.zeros(alpha.shape + (3,), np.uint8), alpha]))
bbs = shadow.getbbox(); shadow = shadow.crop(bbs)
sm = shadow.resize((shadow.width // 2, shadow.height // 2), Image.LANCZOS)
save(sm, 'gr_title_shadow.png')
place('title_shadow', 'gr_title_shadow.png', tx0 - pad + bbs[0], ty0 - pad + bbs[1] + 1 * K, sm.width, sm.height, 200.0)

json.dump(art, open(os.path.join(ART, 'art.json'), 'w'), indent=1)
tot = sum(os.path.getsize(os.path.join(ART, f)) for f in os.listdir(ART) if f.endswith('.png'))
print('total art %.1f KB' % (tot / 1024))
