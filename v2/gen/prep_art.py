#!/usr/bin/env python3
"""Gift Registry v2 hero (Figma 843:763418, blue): cut and optimise the art for the AE comp.
Comp = the card's hero frame 351x206 pt at 3x = 1053x618, origin = card top-left. Writes ../art/*.png|jpg + art.json."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
FIG = os.path.join(ROOT, 'figma'); ART = os.path.join(ROOT, 'art'); os.makedirs(ART, exist_ok=True)
sys.path.insert(0, os.path.expanduser('~/Downloads/nano-ae-motion/scripts'))
from svgpath import parse_d, ae_path

K = 3.0
W, H = int(351 * K), int(206 * K)
cx = lambda x: x * K
cy = lambda y: y * K
art = {'comp': [W, H]}


def err(a, b):
    a = np.asarray(a.convert('RGBA'), float); b = np.asarray(b.convert('RGBA'), float)
    pa = a[..., :3] * a[..., 3:] / 255; pb = b[..., :3] * b[..., 3:] / 255
    e = np.abs(np.concatenate([pa - pb, (a[..., 3:] - b[..., 3:])], axis=2)).mean(axis=2)
    return e.mean(), np.percentile(e, 99.5)


def save(im, name, quant=True):
    p = os.path.join(ART, name); note = 'rgba'
    if quant:
        q = im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        m, p99 = err(im, q)
        oa = np.asarray(im.convert('RGBA'))[..., 3]; qa = np.asarray(q.convert('RGBA'))[..., 3]
        leak = int(qa[oa == 0].max()) if (oa == 0).any() else 0
        aerr = np.abs(oa.astype(int) - qa.astype(int)).max()
        if m <= 2 and p99 <= 32 and leak == 0 and aerr <= 24:
            q.save(p, optimize=True); note = 'pal mean %.2f p99.5 %.1f' % (m, p99)
        else:
            im.save(p, optimize=True); note = 'rgba (pal failed)'
    else:
        im.save(p, optimize=True)
    print('%-22s %4dx%-4d %6.1f KB  %s' % (name, im.width, im.height, os.path.getsize(p) / 1024, note))


def place(key, file, x, y, w, h, scale=100.0):
    art[key] = {'file': file, 'x': round(x, 2), 'y': round(y, 2), 'w': w, 'h': h, 'scale': scale}


# ---- background: atlas crops of the 3x instance clone (instance box at card (-12, 0), 375x235) ----
crop = (int(12 * K), 0, int(363 * K), int(206 * K))
for key, f, q in (('bg_base', 4, False), ('bg_fade', 4, True), ('bg_waves', 6, True)):
    im = Image.open(os.path.join(FIG, key + '.png')).convert('RGBA').crop(crop)
    sm = im.resize((im.width // f, im.height // f), Image.LANCZOS)
    m, p99 = err(im, sm.resize(im.size, Image.BILINEAR))
    print('  %s downscale 1/%d check: mean %.2f p99.5 %.1f' % (key, f, m, p99))
    save(sm, 'gr2_%s.png' % key, quant=q)
    place(key, 'gr2_%s.png' % key, 0, 0, sm.width, sm.height, 100.0 * f)
art['bg_h'] = H
art['corner_r'] = 24 * K

# ---- gift: 3x render of the 153x153 picture at (99, 28); split off what stands apart ----
G = Image.open(os.path.join(FIG, 'gift_3x.png')).convert('RGBA'); GA = np.asarray(G).copy()
gx, gy = cx(99), cy(28)
a = GA[..., 3]
lab, n = ndimage.label(a > 0)
objs = ndimage.find_objects(lab); areas = [(lab[o] == i + 1).sum() for i, o in enumerate(objs)]
main = int(np.argmax(areas))
pieces = {}
grey = [i for i in range(n) if i != main and objs[i][1].start > 360 and areas[i] > 300]
sparks = sorted([i for i in range(n) if i != main and objs[i][1].stop < 150 and areas[i] > 80], key=lambda i: objs[i][0].start)
cen = lambda i: ((objs[i][0].start + objs[i][0].stop) / 2, (objs[i][1].start + objs[i][1].stop) / 2)
groups = {i: [i] for i in sparks}
for i in range(n):                      # specks of glow near the sparkles travel with the nearest one
    if i == main or i in grey or i in sparks or not sparks: continue
    ci = cen(i); j = min(sparks, key=lambda q: (cen(q)[0] - ci[0]) ** 2 + (cen(q)[1] - ci[1]) ** 2)
    if (cen(j)[0] - ci[0]) ** 2 + (cen(j)[1] - ci[1]) ** 2 < 60 ** 2: groups[j].append(i)
for nm, idx in [('star_grey', grey)] + [('spark%d' % (k + 1), groups[i]) for k, i in enumerate(sparks)]:
    m = np.zeros(a.shape, bool)
    for i in idx: m |= lab == i + 1
    pieces[nm] = ndimage.binary_dilation(m, iterations=2)
# green star: touches the lid, so cut it by colour (green-dominant), grown 2 px for its soft edge, inside its own box
g = (GA[..., 1].astype(int) > GA[..., 0].astype(int) + 40) & (GA[..., 1] > GA[..., 2]) & (a > 30)
gl, gn = ndimage.label(g); go = ndimage.find_objects(gl)
star_i = max(range(gn), key=lambda i: (gl[go[i]] == i + 1).sum() if go[i][0].stop < 160 else 0)
sm_ = ndimage.binary_fill_holes(gl == star_i + 1)
sl = go[star_i]
box = np.zeros(a.shape, bool); box[max(0, sl[0].start - 4):sl[0].stop + 4, max(0, sl[1].start - 4):sl[1].stop + 4] = True
pieces['star_green'] = ndimage.binary_dilation(sm_, iterations=3) & box
# spike tips the colour cut missed: small leftovers next to the green star go with it
left = (a > 0)
for m_ in pieces.values(): left &= ~m_
ll, ln = ndimage.label(left); lo = ndimage.find_objects(ll)
for i in range(ln):
    o = lo[i]
    if (ll[o] == i + 1).sum() < 60 and o[0].start >= sl[0].start - 12 and o[0].stop <= sl[0].stop + 12 and o[1].start >= sl[1].start - 12 and o[1].stop <= sl[1].stop + 12:
        pieces['star_green'] |= ndimage.binary_dilation(ll == i + 1, iterations=1)
print('pieces:', {k: int(v.sum()) for k, v in pieces.items()})
rest = np.ones(a.shape, bool)
for nm, m in pieces.items():
    im = GA.copy(); im[..., 3] = np.where(m, im[..., 3], 0)
    s2 = ndimage.find_objects(m.astype(int))[0]
    P = Image.fromarray(im[s2]); save(P, 'gr2_%s.png' % nm)
    place(nm, 'gr2_%s.png' % nm, gx + s2[1].start, gy + s2[0].start, P.width, P.height)
    rest &= ~m
im = GA.copy(); im[..., 3] = np.where(rest, im[..., 3], 0)
B = Image.fromarray(im); bb = B.getbbox(); B = B.crop(bb)
ba = np.asarray(B, float); inside = ba[..., 3] > 0
idx = ndimage.distance_transform_edt(~inside, return_distances=False, return_indices=True)
Image.fromarray(ba[..., :3][idx[0], idx[1]].astype(np.uint8)).save(os.path.join(ART, 'gr2_gift_box.jpg'), quality=86)
Image.fromarray(np.dstack([np.full(inside.shape, 255, np.uint8), ba[..., 3].astype(np.uint8)])).save(os.path.join(ART, 'gr2_gift_box_a.png'), optimize=True)
print('gr2_gift_box.jpg %dx%d %.1f KB + matte %.1f KB' % (B.width, B.height, os.path.getsize(os.path.join(ART, 'gr2_gift_box.jpg')) / 1024,
      os.path.getsize(os.path.join(ART, 'gr2_gift_box_a.png')) / 1024))
place('gift_box', 'gr2_gift_box.jpg', gx + bb[0], gy + bb[1], B.width, B.height)
place('gift_box_a', 'gr2_gift_box_a.png', gx + bb[0], gy + bb[1], B.width, B.height)
art['spark_keys'] = ['spark%d' % (k + 1) for k in range(len(sparks))]
art['box_center'] = [gx + bb[0] + B.width / 2, gy + bb[1] + B.height * 0.62]

# ---- split layers (split_box.py): box back / front and lid as JPEG + alpha matte, hearts as PNG ----
SPL = os.path.join(FIG, 'split')
if os.path.exists(os.path.join(SPL, 'split.json')):
    SJ = json.load(open(os.path.join(SPL, 'split.json')))
    def photo(k):
        im = np.asarray(Image.open(os.path.join(SPL, k + '.png')).convert('RGBA'), float); ins = im[..., 3] > 0
        ix = ndimage.distance_transform_edt(~ins, return_distances=False, return_indices=True)
        Image.fromarray(im[..., :3][ix[0], ix[1]].astype(np.uint8)).save(os.path.join(ART, 'gr2_%s.jpg' % k), quality=86)
        Image.fromarray(np.dstack([np.full(ins.shape, 255, np.uint8), im[..., 3].astype(np.uint8)])).save(os.path.join(ART, 'gr2_%s_a.png' % k), optimize=True)
        x, y = gx + SJ[k]['x'], gy + SJ[k]['y']
        place(k, 'gr2_%s.jpg' % k, x, y, SJ[k]['w'], SJ[k]['h']); place(k + '_a', 'gr2_%s_a.png' % k, x, y, SJ[k]['w'], SJ[k]['h'])
        print('%-22s %4dx%-4d %6.1f KB + matte %.1f KB' % ('gr2_%s.jpg' % k, SJ[k]['w'], SJ[k]['h'], os.path.getsize(os.path.join(ART, 'gr2_%s.jpg' % k)) / 1024,
              os.path.getsize(os.path.join(ART, 'gr2_%s_a.png' % k)) / 1024))
    for k in ('box_back', 'box_front', 'lid'): photo(k)
    for k in ('heart_big', 'heart_small'):
        save(Image.open(os.path.join(SPL, k + '.png')).convert('RGBA'), 'gr2_%s.png' % k)
        place(k, 'gr2_%s.png' % k, gx + SJ[k]['x'], gy + SJ[k]['y'], SJ[k]['w'], SJ[k]['h'])
    art['split'] = True

# ---- swoosh ----
sw = Image.open(os.path.join(FIG, 'swoosh.png')).convert('RGBA'); save(sw, 'gr2_swoosh.png')
SW_RB = (75.599609375, 85.77734375)
place('swoosh', 'gr2_swoosh.png', cx(SW_RB[0]), cy(SW_RB[1]), sw.width, sw.height)
sp = parse_d('M1.72237 30.3249C28.3846 12.0579 93.7294 -10.1177 141.81 47.3152C145.018 29.3752 162.021 -4.3071 204.37 4.48453')[0]
art['swoosh_path'] = ae_path(sp, lambda X, Y: (round(cx(SW_RB[0] + X), 2), round(cy(SW_RB[1] + Y), 2)))

# ---- title (same glyphs as v1; new place and colours: black -> #6199FF) ----
TRB = (56.630859375, 138.3603515625)
d = open(os.path.join(FIG, 'title_d.txt')).read().strip()
json.dump({'title': {'d': d, 'rb': [TRB[0], TRB[1], 237.76, 58.344]}}, open(os.path.join(HERE, 'glyphs.json'), 'w'))
json.dump({'title': {'figma_center': [0, 0], 'comp_center': [0, 0], 'px_per_pt': K}}, open(os.path.join(HERE, 'mapping.json'), 'w'))
art['baseline_y'] = round(cy(TRB[1] + 37.64), 2)
p1 = np.array([cx(TRB[0] + 37.3691), cy(TRB[1] + 24.6396)]); p2 = np.array([cx(TRB[0] + 135.889), cy(TRB[1] - 133.855)])
tx0, ty0, tx1, ty1 = int(cx(TRB[0])) - 4, int(cy(TRB[1])) - 4, int(cx(TRB[0] + 237.76)) + 4, int(cy(TRB[1] + 58.344)) + 4
F = 4; gw, gh = (tx1 - tx0) // F + 1, (ty1 - ty0) // F + 1
yy, xx = np.mgrid[0:gh, 0:gw]; X = tx0 + xx * F; Y = ty0 + yy * F
v = p2 - p1; t = np.clip(((X - p1[0]) * v[0] + (Y - p1[1]) * v[1]) / (v @ v), 0, 1)
c1 = np.array([0, 0, 0]); c2 = np.array([0x61, 0x99, 0xFF])
rgb = (c1[None, None] * (1 - t[..., None]) + c2[None, None] * t[..., None]).round().astype(np.uint8)
save(Image.fromarray(np.dstack([rgb, np.full(t.shape, 255, np.uint8)])), 'gr2_title_grad.png', quant=False)
place('title_grad', 'gr2_title_grad.png', tx0, ty0, gw, gh, 100.0 * F)
pad = 60; SW_, SH_ = tx1 - tx0 + 2 * pad, ty1 - ty0 + 2 * pad; SS = 2
mask = Image.new('L', (SW_ * SS, SH_ * SS), 0); dr = ImageDraw.Draw(mask)
def flatten(s):
    pts = [s['pts'][0]]
    for k, seg in enumerate(s['segs']):
        p0, p3 = s['pts'][k], s['pts'][k + 1]
        if seg is None: pts.append(p3); continue
        a1, a2 = seg
        for u in np.linspace(0, 1, 12)[1:]:
            pts.append(((1-u)**3*p0[0] + 3*(1-u)**2*u*a1[0] + 3*(1-u)*u**2*a2[0] + u**3*p3[0], (1-u)**3*p0[1] + 3*(1-u)**2*u*a1[1] + 3*(1-u)*u**2*a2[1] + u**3*p3[1]))
    return pts
def area(p): p = np.array(p); return 0.5 * np.sum(p[:, 0] * np.roll(p[:, 1], -1) - np.roll(p[:, 0], -1) * p[:, 1])
subs = [flatten(s) for s in parse_d(d)]; Ar = [area(p) for p in subs]; sg = np.sign(Ar[int(np.argmax(np.abs(Ar)))])
for p, ar in zip(subs, Ar):
    if np.sign(ar) == sg: dr.polygon([((cx(TRB[0] + x) - tx0 + pad) * SS, (cy(TRB[1] + y) - ty0 + pad) * SS) for x, y in p], fill=255)
mask = mask.resize((SW_, SH_), Image.LANCZOS)
sh = mask.filter(ImageFilter.MaxFilter(2 * int(5 * K) + 1)).filter(ImageFilter.GaussianBlur(3.5 * K))
al = (np.asarray(sh, float) * 0.15).round().astype(np.uint8)
shadow = Image.fromarray(np.dstack([np.zeros(al.shape + (3,), np.uint8), al])); bbs = shadow.getbbox(); shadow = shadow.crop(bbs)
smh = shadow.resize((shadow.width // 2, shadow.height // 2), Image.LANCZOS); save(smh, 'gr2_title_shadow.png')
place('title_shadow', 'gr2_title_shadow.png', tx0 - pad + bbs[0], ty0 - pad + bbs[1] + 1 * K, smh.width, smh.height, 200.0)

json.dump(art, open(os.path.join(ART, 'art.json'), 'w'), indent=1)
print('total art %.1f KB' % (sum(os.path.getsize(os.path.join(ART, f)) for f in os.listdir(ART) if f[-4:] in ('.png', '.jpg')) / 1024))
