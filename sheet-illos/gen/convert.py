#!/usr/bin/env python3
"""Bottom sheet lotties: AE dump (../verify/dump/*.json, from ../build/dump.jsx) -> minified Lottie .json + dotLottie .lottie
(images as WebP) in ../export/. Adapted from occasions/exporter/convert.py: same layer/keyframe conversion, plus comp markers
('intro', 'idle') and fps read from the dump. PNGs go through the occasions TinyPNG cache only if they were tinified there
(tinify_sheet.py, needs env TINIFY_KEY); otherwise the original PNG bytes are embedded.
usage: convert.py [--only SUBSTR] [--dump DIRNAME]   (portrait cards: --dump dump_portrait)"""
import json, glob, os, sys, io, re, base64, zipfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DUMP = os.path.join(ROOT, 'verify', sys.argv[sys.argv.index('--dump') + 1] if '--dump' in sys.argv else 'dump')
OUT = os.path.join(ROOT, 'export')
FPS = 60.0

NAMES = {'GR sheet \u00b7 Collection': 'gr-sheet-collection', 'GR sheet \u00b7 Gift registry': 'gr-sheet-registry',
         'GR card \u00b7 Collection (portrait)': 'gr-card-portrait-collection', 'GR card \u00b7 Gift registry (portrait)': 'gr-card-portrait-registry',
         # dev spec 20 Nov (own opaque background, 164 wide): these replace the four files above
         'GR sheet \u00b7 Collection \u00b7 164 bg': 'gr-sheet-collection', 'GR sheet \u00b7 Gift registry \u00b7 164 bg': 'gr-sheet-registry',
         'GR card \u00b7 Collection (portrait) \u00b7 full card': 'gr-card-portrait-collection',
         'GR card \u00b7 Gift registry (portrait) \u00b7 full card': 'gr-card-portrait-registry'}

def rnd(o, nd=3):
    if isinstance(o, float):
        r = round(o, nd)
        if r == 0: return 0
        return int(r) if r == int(r) else r
    if isinstance(o, list): return [rnd(x, nd) for x in o]
    if isinstance(o, dict):
        if o.get('ty') in ('fl', 'gf'): nd = max(nd, 5)      # colours: 3 decimals = 0.26 of a level, too coarse for a flat background
        return {k: rnd(v, nd) for k, v in o.items()}
    return o

def frames(sec): return sec * FPS

def find(grp, mn):
    for p in grp['props']:
        if p['mn'] == mn: return p
    return None

def num(v): return v

# ---- TinyPNG cache (tinify.py): PNGs are replaced by their tinified bytes unless the quality guard kept the original
import hashlib
_TREP = {}
TINY = os.path.join(ROOT, 'verify', 'tiny_cache')
_rp = os.path.join(TINY, 'report.json')
if os.path.exists(_rp): _TREP = json.load(open(_rp))
def png_bytes(path):
    raw = open(path, 'rb').read()
    h = hashlib.md5(raw).hexdigest()
    r = _TREP.get(h)
    if r and not r['keep_orig']:
        return open(os.path.join(TINY, h + '.png'), 'rb').read()
    return raw

# ---- keyframed property -> lottie {a,k}
def conv_prop(p, dims, spatial=False):
    """dims: number of components to export (1 = scalar prop, 2 = 2D). Returns lottie {'a':..,'k':..}"""
    if not p.get('keys'):
        v = p['v']
        if dims == 1:
            return {'a': 0, 'k': v if not isinstance(v, list) else v[0]}
        return {'a': 0, 'k': v[:dims]}
    keys = p['keys']
    out = []
    for n, k in enumerate(keys):
        v = k['v']
        s = [v] if not isinstance(v, list) else v[:dims]
        kf = {'t': frames(k['t']), 's': s}
        last = n == len(keys) - 1
        if not last:
            if k['io'] == 'HOLD':
                kf['h'] = 1
                kf['o'] = {'x': 0.167, 'y': 0.167}; kf['i'] = {'x': 0.833, 'y': 0.833}
            else:
                assert k['io'] == 'BEZIER' and keys[n + 1]['ii'] == 'BEZIER', (p['mn'], k['io'])
                eo = k['eo']; ei = keys[n + 1]['ei']
                for e in eo + ei: assert abs(e[0]) < 1e-9, ('nonzero speed', e)
                nd = 1 if (dims == 1 or spatial) else dims
                if len(eo) < nd: eo = eo + [eo[-1]] * (nd - len(eo))
                if len(ei) < nd: ei = ei + [ei[-1]] * (nd - len(ei))
                ox = [e[1] / 100.0 for e in eo[:nd]]
                ix = [1 - e[1] / 100.0 for e in ei[:nd]]
                if nd == 1:
                    kf['o'] = {'x': ox[0], 'y': 0}; kf['i'] = {'x': ix[0], 'y': 1}
                else:
                    kf['o'] = {'x': ox, 'y': [0] * nd}; kf['i'] = {'x': ix, 'y': [1] * nd}
            if spatial and k.get('ti') is not None:
                ti, to = k['ti'][:2], k['to'][:2]
                if any(abs(x) > 1e-6 for x in ti + to):
                    kf['to'] = to; kf['ti'] = ti
        out.append(kf)
    return {'a': 1, 'k': out}

def has_keys(p): return bool(p.get('keys'))

def conv_transform(tg, layer_level=True):
    P = {p['mn']: p for p in tg['props']}
    ks = {}
    ks['a'] = conv_prop(P['ADBE Anchor Point'], 2)
    # separated position?
    p0, p1 = P.get('ADBE Position_0'), P.get('ADBE Position_1')
    if p0 and p1 and (has_keys(p0) or has_keys(p1)):
        # with dimensions separated AE's combined Position can mirror the X/Y keys (seen after a hand edit): X/Y are the truth
        ks['p'] = {'s': True, 'x': conv_prop(p0, 1), 'y': conv_prop(p1, 1)}
    else:
        ks['p'] = conv_prop(P['ADBE Position'], 2, spatial=True)
    ks['s'] = conv_prop(P['ADBE Scale'], 2)
    ks['r'] = conv_prop(P['ADBE Rotate Z'], 1)
    ks['o'] = conv_prop(P['ADBE Opacity'], 1)
    return ks

def conv_group_tr(tg):
    P = {p['mn']: p for p in tg['props']}
    return {'ty': 'tr', 'a': conv_prop(P['ADBE Vector Anchor'], 2), 'p': conv_prop(P['ADBE Vector Position'], 2, spatial=True),
            's': conv_prop(P['ADBE Vector Scale'], 2), 'r': conv_prop(P['ADBE Vector Rotation'], 1),
            'o': conv_prop(P['ADBE Vector Group Opacity'], 1), 'sk': conv_prop(P['ADBE Vector Skew'], 1),
            'sa': conv_prop(P['ADBE Vector Skew Axis'], 1)}

CAP = {1: 1, 2: 2, 3: 3}; JOIN = {1: 1, 2: 2, 3: 3}

def conv_items(contents):
    items = []
    for it in contents['props']:
        mn = it['mn']
        if not it.get('en', True): raise Exception('disabled item ' + it['nm'])
        if mn == 'ADBE Vector Shape - Group':
            sp = find(it, 'ADBE Vector Shape'); assert not has_keys(sp)
            v = sp['v']
            items.append({'ty': 'sh', 'nm': it['nm'], 'd': 1, 'ks': {'a': 0, 'k': {'c': v['closed'], 'i': v['inTangents'], 'o': v['outTangents'], 'v': v['vertices']}}})
        elif mn == 'ADBE Vector Graphic - Fill':
            P = {p['mn']: p for p in it['props']}
            c = P['ADBE Vector Fill Color']['v']
            items.append({'ty': 'fl', 'nm': it['nm'], 'c': {'a': 0, 'k': [c[0], c[1], c[2], 1]}, 'r': 1 if P['ADBE Vector Fill Rule']['v'] == 1 else 2,
                          'o': conv_prop(P['ADBE Vector Fill Opacity'], 1)})
        elif mn == 'ADBE Vector Graphic - Stroke':
            P = {p['mn']: p for p in it['props']}
            c = P['ADBE Vector Stroke Color']['v']
            assert not has_keys(P['ADBE Vector Stroke Width'])
            flat = {}
            def fl_(g):
                for q in g['props']:
                    if q.get('group'): fl_(q)
                    else: flat[q['mn']] = q
            fl_(it)
            for dn in ('ADBE Vector Taper Start Length', 'ADBE Vector Taper End Length', 'ADBE Vector Stroke Offset'):
                assert flat[dn]['v'] == 0, dn
            items.append({'ty': 'st', 'nm': it['nm'], 'c': {'a': 0, 'k': [c[0], c[1], c[2], 1]}, 'o': conv_prop(P['ADBE Vector Stroke Opacity'], 1),
                          'w': conv_prop(P['ADBE Vector Stroke Width'], 1), 'lc': CAP[int(P['ADBE Vector Stroke Line Cap']['v'])],
                          'lj': JOIN[int(P['ADBE Vector Stroke Line Join']['v'])], 'ml': 4})
        elif mn == 'ADBE Vector Filter - Trim':
            P = {p['mn']: p for p in it['props']}
            items.append({'ty': 'tm', 'nm': it['nm'], 's': conv_prop(P['ADBE Vector Trim Start'], 1), 'e': conv_prop(P['ADBE Vector Trim End'], 1),
                          'o': conv_prop(P['ADBE Vector Trim Offset'], 1), 'm': 1})
        elif mn == 'ADBE Vector Group':
            sub = find(it, 'ADBE Vectors Group'); tg = find(it, 'ADBE Vector Transform Group')
            inner = conv_items(sub); inner.append(conv_group_tr(tg))
            items.append({'ty': 'gr', 'nm': it['nm'], 'it': inner})
        else:
            raise Exception('unsupported shape item ' + mn)
    return items

def bg_shapes(spec):
    """'lottie-bg:' layer comment (gen_build_164.py) -> lottie shapes: one rect per item with a solid or gradient fill.
    In AE the same background is drawn as solid rings / bands (AE scripts can't set gradient colours)."""
    # renderers turn 0..1 colours into 8-bit levels by truncation (lottie-web) or rounding: nudge up 0.3 of a level so both land on it
    nudge = lambda c: [min(1.0, v + 0.3 / 255) for v in c]
    items = []
    for it in spec['items']:
        x, y, w, h = it['rect']
        rc = {'ty': 'rc', 'nm': 'rect', 'd': 1, 's': {'a': 0, 'k': [w, h]}, 'p': {'a': 0, 'k': [x + w / 2.0, y + h / 2.0]}, 'r': {'a': 0, 'k': 0}}
        if 'solid' in it:
            c = nudge(it['solid']); fl = {'ty': 'fl', 'nm': 'fill', 'c': {'a': 0, 'k': [c[0], c[1], c[2], 1]}, 'o': {'a': 0, 'k': 100}, 'r': 1, 'bm': 0}
        else:
            g = it['grad']; st = [[s_[0]] + nudge(s_[1:4]) + [s_[4]] for s_ in g['stops']]
            k = [v for s in st for v in (s[0], s[1], s[2], s[3])] + [v for s in st for v in (s[0], s[4])]
            fl = {'ty': 'gf', 'nm': 'gradient', 'o': {'a': 0, 'k': 100}, 'r': 1, 'bm': 0, 'g': {'p': len(st), 'k': {'a': 0, 'k': k}},
                  's': {'a': 0, 'k': g['s']}, 'e': {'a': 0, 'k': g['e']}, 't': g['t'], 'h': {'a': 0, 'k': 0}, 'a': {'a': 0, 'k': 0}}
        tr = {'ty': 'tr', 'a': {'a': 0, 'k': [0, 0]}, 'p': {'a': 0, 'k': [0, 0]}, 's': {'a': 0, 'k': [100, 100]}, 'r': {'a': 0, 'k': 0},
              'o': {'a': 0, 'k': 100}, 'sk': {'a': 0, 'k': 0}, 'sa': {'a': 0, 'k': 0}}
        items.append({'ty': 'gr', 'nm': it.get('name', 'bg'), 'it': [rc, fl, tr]})
    return items

def convert(path):
    global FPS
    d = json.load(open(path))
    FPS = float(d['fps'])
    base = NAMES[d['name']]
    assets, aid = [], {}
    layers = []
    for L in d['layers']:
        assert L['startTime'] == 0 and L['stretch'] == 100 and L['blendNormal'] and not L['threeD']
        ks = conv_transform(L['transform'])
        lay = {'ddd': 0, 'ind': L['index'], 'ty': {'shape': 4, 'null': 3, 'footage': 2}[L['kind']], 'nm': L['name'], 'sr': 1, 'ks': ks, 'ao': 0}
        if L['parent']: lay['parent'] = L['parent']
        if L['kind'] == 'footage':
            f = L['file']
            if f not in aid:
                im = Image.open(f); assert im.size == (L['srcW'], L['srcH']), (f, im.size, L['srcW'], L['srcH'])
                mime = 'image/png' if f.lower().endswith('.png') else 'image/jpeg'
                aid[f] = str(len(assets) + 1)
                assets.append({'id': aid[f], 'w': im.size[0], 'h': im.size[1], 'u': '', 'p': 'data:%s;base64,%s' % (mime, base64.b64encode(png_bytes(f) if mime == 'image/png' else open(f, 'rb').read()).decode()), 'e': 1, '_src': f})
            lay['refId'] = aid[f]
        if L['kind'] == 'shape' and (L.get('comment') or '').startswith('lottie-bg:'):
            lay['shapes'] = bg_shapes(json.loads(L['comment'][len('lottie-bg:'):]))
        elif L['kind'] == 'shape':
            lay['shapes'] = conv_items(L['contents'])
        lay.update({'ip': frames(L['inPoint']), 'op': frames(L['outPoint']), 'st': 0, 'bm': 0})
        if L['isTrackMatte']: lay['td'] = 1
        if L['hasTrackMatte']:
            assert L['matteType'] == 'ALPHA'
            lay['tt'] = 1; lay['tp'] = L['matteLayer'] if L['matteLayer'] else L['index'] - 1
        if not L['en'] and not L['isTrackMatte']: lay['hd'] = True
        layers.append(lay)
    # matte adjacency sanity
    for n, lay in enumerate(layers):
        if lay.get('tt'): assert layers[n - 1].get('td') == 1 and layers[n - 1]['ind'] == lay['tp'], d['name']
    markers = [{'cm': m['cm'], 'tm': round(m['t'] * FPS), 'dr': round(m['dr'] * FPS)} for m in d.get('markers', [])]
    anim = {'v': '5.7.0', 'fr': FPS, 'ip': 0, 'op': round(d['dur'] * FPS), 'w': d['w'], 'h': d['h'], 'nm': base, 'ddd': 0,
            'assets': assets, 'layers': layers, 'markers': markers, 'meta': {'g': '@lottiefiles/toolkit-js 0.76.0'}}
    return anim, '', base

def dumps(o):
    return json.dumps(rnd(o), separators=(',', ':'), ensure_ascii=True)

def to_webp(asset):
    src = asset['_src']; b = io.BytesIO()
    if src.lower().endswith('.png'):
        im = Image.open(io.BytesIO(png_bytes(src))).convert('RGBA'); im.save(b, 'WEBP', lossless=True, quality=100, method=6, exact=False)
    else:
        im = Image.open(src).convert('RGB'); im.save(b, 'WEBP', quality=85, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()

def main():
    only = None
    if '--only' in sys.argv: only = sys.argv[sys.argv.index('--only') + 1]
    rows = []
    for path in sorted(glob.glob(os.path.join(DUMP, '*.json'))):
        if only and only not in os.path.basename(path): continue
        anim, folder, base = convert(path)
        od = OUT; os.makedirs(od, exist_ok=True)
        a1 = json.loads(json.dumps(anim))
        for a in a1['assets']: a.pop('_src')
        js = dumps(a1)
        open(os.path.join(od, base + '.json'), 'w').write(js)
        a2 = json.loads(json.dumps(anim))
        for a in a2['assets']: a['p'] = to_webp(a); a['_src'] = None; a.pop('_src')
        js2 = dumps(a2)
        manifest = '{"generator":"LottieFiles dotLottie Exporter 0.1","animations":[{"loop":false,"themeColor":"#ffcc00","speed":1.0,"id":"%s"}],"version":"1.0","author":"LottieFiles"}' % base
        with zipfile.ZipFile(os.path.join(od, base + '.lottie'), 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            z.writestr('manifest.json', manifest); z.writestr('animations/%s.json' % base, js2)
        rows.append((folder, base, len(js), os.path.getsize(os.path.join(od, base + '.lottie'))))
        print(base, 'json', len(js), 'lottie', rows[-1][3], '%.0f%%' % (100.0 * rows[-1][3] / len(js)), 'markers', anim['markers'])
    json.dump(rows, open(os.path.join(ROOT, 'verify', 'sizes.json' if os.path.basename(DUMP) == 'dump' else 'sizes_%s.json' % os.path.basename(DUMP)), 'w')) if not only else None

main()
