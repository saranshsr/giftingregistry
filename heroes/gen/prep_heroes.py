#!/usr/bin/env python3
"""Gift Registry page heroes: art + title glyphs for each page, for the AE builder.
Input: ../art/<page>/{sw,ill,ill2,ill_bitN}.png + ../art/pieces.json (cut_place.py), ../figma/titles/<page>.svg
Output: ../art/<page>/hero.json (placements in comp px, title pieces, gradient)  + optimised pictures.
Comp: hero frame x 0..375, y -14..162 pt at 3x -> 1125 x 528. No background (all lotties are bg-free)."""
import json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
ART = os.path.join(ROOT, 'art'); TIT = os.path.join(ROOT, 'figma', 'titles')
sys.path.insert(0, os.path.expanduser('~/Downloads/nano-ae-motion/scripts'))
from svgpath import parse_d
import importlib.util
spec = importlib.util.spec_from_file_location('g2a', os.path.expanduser('~/Downloads/nano-ae-motion/scripts/glyphs_to_ae.py'))
g2a = importlib.util.module_from_spec(spec); spec.loader.exec_module(g2a)
# group glyph outlines per line: the stock grouper joins outers that overlap in x, which merges letters across lines
_src = open(os.path.expanduser('~/Downloads/nano-ae-motion/scripts/glyphs_to_ae.py')).read()
# letters: join outers that overlap in x on the SAME line (split by centre). Dots (i, j, ?) never join pairwise: each dot
# is given to ONE glyph afterwards, preferring the stem right below it. On tight two-line titles a line-2 i-dot sits
# above the midline and right under a line-1 letter, so the old rule handed it to that letter (the "N" bug).
_src = _src.replace("if a < b and min(bb[a][2], bb[b][2]) - max(bb[a][0], bb[b][0]) > 1.0:",
                    "if a < b and not _isdot(bb, a, m) and not _isdot(bb, b, m) and min(bb[a][2], bb[b][2]) - max(bb[a][0], bb[b][0]) > 1.0 and min(bb[a][3], bb[b][3]) - max(bb[a][1], bb[b][1]) > -18.0 and ((bb[a][1] + bb[a][3]) / 2 > m.get('split', 1e9)) == ((bb[b][1] + bb[b][3]) / 2 > m.get('split', 1e9)):")
_src = _src.replace("    groups = {}\n", "    for d_ in outer:\n        if _isdot(bb, d_, m):\n            t_ = _dot_target(bb, outer, d_, m)\n            if t_ is not None: par[d_] = root(t_)\n    groups = {}\n", 1)
assert "_isdot(bb, a, m)" in _src and "_dot_target" in _src


def _isdot(bb, q, m):
    S = m['px_per_pt']; return (bb[q][3] - bb[q][1]) < 9 * S and (bb[q][2] - bb[q][0]) < 9 * S


def _dot_target(bb, outer, d, m):
    S = m['px_per_pt']; cxd = (bb[d][0] + bb[d][2]) / 2
    cand = [o for o in outer if o != d and not _isdot(bb, o, m) and bb[o][0] - 1 <= cxd <= bb[o][2] + 1]
    below = [o for o in cand if -1 * S <= bb[o][1] - bb[d][3] < 6 * S]        # i / j stem under the dot
    if below: return min(below, key=lambda o: bb[o][1] - bb[d][3])
    above = [o for o in cand if -1 * S <= bb[d][1] - bb[o][3] < 6 * S]        # ? / ! body over the dot
    return min(above, key=lambda o: bb[d][1] - bb[o][3]) if above else None


_ns = {'__name__': 'g2a_lines', '__file__': os.path.expanduser('~/Downloads/nano-ae-motion/scripts/glyphs_to_ae.py'), '_isdot': _isdot, '_dot_target': _dot_target}
exec(compile(_src, 'glyphs_to_ae_lines', 'exec'), _ns)
g2a.build = _ns['build']

K, CY0 = 3.0, -14.0
W, H = 1125, 528
cx = lambda x: x * K
cy = lambda y: (y - CY0) * K
PAGES = {   # page: (title, Figma frame, title render bounds xy in hero-frame pt, swoosh render bounds xy)
    'p1': ('1.3 When is it?', '902:194908', (84.1, 75.4), (83.21, 30.9)),
    'p2': ('1.4 Delivery Details', '902:194942', (46.7, 75.4), (84.21, 18.28)),
    'p3': ('2.3 Whose birthday is it?', '902:195029', (58.3, 78.3), (83.21, 29.54)),
    'p4': ('2.5 When is the due date?', '902:195059', (88.9, 78.3), (85.02, 39.78)),
    'p5': ('1.1 Occasion?', '902:194789', (89.7, 95.4), (85.1, 28.78)),
    'p6': ('Name your gift registry', '902:194884', (86.6, 79.6), (82.02, 29.78)),
}
P = json.load(open(os.path.join(ART, 'pieces.json')))
LINES = {'p1': 1, 'p2': 1, 'p3': 2, 'p4': 2, 'p5': 1, 'p6': 2}


def err(a, b):
    a = np.asarray(a.convert('RGBA'), float); b = np.asarray(b.convert('RGBA'), float)
    pa = a[..., :3] * a[..., 3:] / 255; pb = b[..., :3] * b[..., 3:] / 255
    e = np.abs(np.concatenate([pa - pb, (a[..., 3:] - b[..., 3:])], axis=2)).mean(axis=2)
    return e.mean(), np.percentile(e, 99.5)


def save_png(im, path):
    q = im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    m, p99 = err(im, q)
    oa = np.asarray(im.convert('RGBA'))[..., 3]; qa = np.asarray(q.convert('RGBA'))[..., 3]
    leak = int(qa[oa == 0].max()) if (oa == 0).any() else 0
    if m <= 2 and p99 <= 32 and leak == 0 and np.abs(oa.astype(int) - qa.astype(int)).max() <= 24: q.save(path, optimize=True)
    else: im.save(path, optimize=True)
    return os.path.getsize(path)


def photo(im, base):
    """Chrome illustration: JPEG colour (edges bled out) + alpha matte PNG."""
    ba = np.asarray(im, float); ins = ba[..., 3] > 0
    ix = ndimage.distance_transform_edt(~ins, return_distances=False, return_indices=True)
    Image.fromarray(ba[..., :3][ix[0], ix[1]].astype(np.uint8)).save(base + '.jpg', quality=86)
    Image.fromarray(np.dstack([np.full(ins.shape, 255, np.uint8), ba[..., 3].astype(np.uint8)])).save(base + '_a.png', optimize=True)
    return os.path.getsize(base + '.jpg') + os.path.getsize(base + '_a.png')


def flatten(sp):
    pts = [sp['pts'][0]]
    for k, seg in enumerate(sp['segs']):
        p0, p3 = sp['pts'][k], sp['pts'][k + 1]
        if seg is None: pts.append(p3); continue
        a1, a2 = seg
        for u in np.linspace(0, 1, 12)[1:]:
            pts.append(((1-u)**3*p0[0] + 3*(1-u)**2*u*a1[0] + 3*(1-u)*u**2*a2[0] + u**3*p3[0], (1-u)**3*p0[1] + 3*(1-u)**2*u*a1[1] + 3*(1-u)*u**2*a2[1] + u**3*p3[1]))
    return pts


def area(p): p = np.array(p); return 0.5 * np.sum(p[:, 0] * np.roll(p[:, 1], -1) - np.roll(p[:, 0], -1) * p[:, 1])


def title_art(D, svg, trb, nlines, spec_):
    """Title glyph pieces (per line, dots with their own letter), gradient picture and soft shadow -> spec_ / D."""
    # title: glyph pieces in reading order (line by line), gradient picture, soft shadow
    d = re.search(r'<path d="([^"]*)" fill="url\(#paint0[^"]*\)"', svg).group(1)
    g = re.search(r'<linearGradient[^>]*x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"[^>]*>(.*?)</linearGradient>', svg, re.S)
    gx1, gy1, gx2, gy2 = map(float, g.groups()[:4])
    c2 = re.findall(r'stop-color="(#[0-9A-Fa-f]{6})"', g.group(5))[-1]
    vb = [float(v) for v in re.search(r'viewBox="([^"]*)"', svg).group(1).split()]
    split_px = cy(trb[1] + vb[3] / 2) if nlines == 2 else 1e9
    pieces = g2a.build({'d': d, 'rb': [trb[0], trb[1], 0, 0]}, {'figma_center': [0, CY0], 'comp_center': [0, 0], 'px_per_pt': K, 'split': split_px})
    NL = nlines
    split = split_px
    line_of = lambda p: 0 if NL == 1 else int((p['box'][1] + p['box'][3]) / 2 > split)
    pieces.sort(key=lambda p: (line_of(p), (p['box'][0] + p['box'][2]) / 2))
    allpaths = [q for p in pieces for q in p['paths']]
    pa = lambda v: 0.5 * sum(v[i][0] * v[(i + 1) % len(v)][1] - v[(i + 1) % len(v)][0] * v[i][1] for i in range(len(v)))
    big = max(allpaths, key=lambda q: abs(pa(q['v']))); osg = 1 if pa(big['v']) > 0 else -1
    tp = []
    for p in pieces:
        # baseline per line: the bottom of the line's non-descender letters ~ the most common box bottom
        tp.append({'line': line_of(p), 'cx': (p['box'][0] + p['box'][2]) / 2, 'bottom': p['box'][3], 'paths': p['paths'],
                   'outers': [q for q in p['paths'] if (1 if pa(q['v']) > 0 else -1) == osg]})
    for ln in set(t['line'] for t in tp):
        bl = float(np.median([t['bottom'] for t in tp if t['line'] == ln]))
        for t in tp:
            if t['line'] == ln: t['pivot'] = [round(t['cx'], 2), round(bl, 2)]
    for t in tp: del t['cx'], t['bottom']
    spec_['title'] = tp; spec_['title_lines'] = 1 + max(t['line'] for t in tp)
    # gradient (SVG user space = title render-bounds origin), black -> c2
    p1 = np.array([cx(trb[0] + gx1), cy(trb[1] + gy1)]); p2 = np.array([cx(trb[0] + gx2), cy(trb[1] + gy2)])
    vb = [float(v) for v in re.search(r'viewBox="([^"]*)"', svg).group(1).split()]
    tx0, ty0 = int(cx(trb[0])) - 4, int(cy(trb[1])) - 4; tx1, ty1 = int(cx(trb[0] + vb[2])) + 4, int(cy(trb[1] + vb[3])) + 4
    F = 4; gw, gh = (tx1 - tx0) // F + 1, (ty1 - ty0) // F + 1
    yy, xx = np.mgrid[0:gh, 0:gw]; X = tx0 + xx * F; Y = ty0 + yy * F
    v = p2 - p1; t = np.clip(((X - p1[0]) * v[0] + (Y - p1[1]) * v[1]) / (v @ v), 0, 1)
    col2 = np.array([int(c2[i:i + 2], 16) for i in (1, 3, 5)])
    rgb = (col2[None, None] * t[..., None]).round().astype(np.uint8)
    Image.fromarray(np.dstack([rgb, np.full(t.shape, 255, np.uint8)])).save(os.path.join(D, 'gr_title_grad.png'), optimize=True)
    spec_['files']['title_grad'] = {'file': 'gr_title_grad.png', 'x': tx0, 'y': ty0, 'w': gw, 'h': gh, 'scale': 100.0 * F}
    spec_['grad_end'] = c2
    pad = 60; SW_, SH_ = tx1 - tx0 + 2 * pad, ty1 - ty0 + 2 * pad; SS = 2
    mask = Image.new('L', (SW_ * SS, SH_ * SS), 0); dr = ImageDraw.Draw(mask)
    subs = [flatten(s) for s in parse_d(d)]; Ar = [area(q) for q in subs]; sg = np.sign(Ar[int(np.argmax(np.abs(Ar)))])
    for q, ar in zip(subs, Ar):
        if np.sign(ar) == sg: dr.polygon([((cx(trb[0] + x) - tx0 + pad) * SS, (cy(trb[1] + y) - ty0 + pad) * SS) for x, y in q], fill=255)
    mask = mask.resize((SW_, SH_), Image.LANCZOS)
    sh = mask.filter(ImageFilter.MaxFilter(2 * int(5 * K) + 1)).filter(ImageFilter.GaussianBlur(3.5 * K))
    al = (np.asarray(sh, float) * 0.15).round().astype(np.uint8)
    shadow = Image.fromarray(np.dstack([np.zeros(al.shape + (3,), np.uint8), al])); bbs = shadow.getbbox(); shadow = shadow.crop(bbs)
    smh = shadow.resize((shadow.width // 2, shadow.height // 2), Image.LANCZOS); smh.save(os.path.join(D, 'gr_title_shadow.png'), optimize=True)
    spec_['files']['title_shadow'] = {'file': 'gr_title_shadow.png', 'x': tx0 - pad + bbs[0], 'y': ty0 - pad + bbs[1] + 1 * K, 'w': smh.width, 'h': smh.height, 'scale': 200.0}
    return os.path.getsize(os.path.join(D, 'gr_title_grad.png')) + os.path.getsize(os.path.join(D, 'gr_title_shadow.png'))


if __name__ != '__main__': PAGES = {}
total = {}
for pg, (title, frame, trb, srb) in PAGES.items():
    D = os.path.join(ART, pg); spec_ = {'page': pg, 'title_text': title, 'figma_frame': frame, 'comp': [W, H], 'files': {}}
    size = 0
    # swoosh (placed by its Figma render bounds) and the pieces (placed by matching)
    sw = Image.open(os.path.join(D, 'sw.png')).convert('RGBA'); size += save_png(sw, os.path.join(D, 'gr_sw.png'))
    spec_['files']['sw'] = {'file': 'gr_sw.png', 'x': cx(srb[0]), 'y': cy(srb[1]), 'w': sw.width, 'h': sw.height}
    ill = Image.open(os.path.join(D, 'ill.png')).convert('RGBA'); size += photo(ill, os.path.join(D, 'gr_ill'))
    e = P[pg]['ill']
    spec_['files']['ill'] = {'file': 'gr_ill.jpg', 'x': e['x'], 'y': e['y'], 'w': ill.width, 'h': ill.height}
    spec_['files']['ill_a'] = {'file': 'gr_ill_a.png', 'x': e['x'], 'y': e['y'], 'w': ill.width, 'h': ill.height}
    bits = []
    for k in sorted(P[pg]):
        if k == 'ill2' or '_bit' in k:
            im = Image.open(os.path.join(D, k + '.png')).convert('RGBA'); size += save_png(im, os.path.join(D, 'gr_%s.png' % k))
            spec_['files'][k] = {'file': 'gr_%s.png' % k, 'x': P[pg][k]['x'], 'y': P[pg][k]['y'], 'w': im.width, 'h': im.height}
            a_ = np.asarray(im)[..., 3]; bits.append({'key': k, 'area': int((a_ > 128).sum())})
    spec_['bits'] = bits
    ia = np.asarray(ill)[..., 3] > 0; ys, xs = np.where(ia)
    spec_['ill_base'] = [e['x'] + (xs.min() + xs.max()) / 2, e['y'] + ys.max()]           # bottom middle of the body
    spec_['ill_center'] = [e['x'] + (xs.min() + xs.max()) / 2, e['y'] + (ys.min() + ys.max()) / 2]

    size += title_art(D, open(os.path.join(TIT, pg + '.svg')).read(), trb, LINES[pg], spec_)
    # content-hashed file names: AE caches footage by path, so a changed picture must be a new file
    import hashlib, glob as _g
    for old in _g.glob(os.path.join(D, 'gr_*.*.*')):
        try: os.remove(old)                              # previous hashed copies (ours)
        except OSError: pass
    for k, f in spec_['files'].items():
        src = os.path.join(D, f['file']); h = hashlib.md5(open(src, 'rb').read()).hexdigest()[:8]
        base, ext = os.path.splitext(f['file']); new = '%s.%s%s' % (base, h, ext)
        import shutil; shutil.copyfile(src, os.path.join(D, new)); f['file'] = new
    json.dump(spec_, open(os.path.join(D, 'hero.json'), 'w'))
    total[pg] = size
    print('%s %-28s pieces %2d (%d line%s)  bits %d  art %.0f KB' % (pg, title, len(spec_['title']), spec_['title_lines'], 's' if spec_['title_lines'] > 1 else '', len(bits), size / 1024))
