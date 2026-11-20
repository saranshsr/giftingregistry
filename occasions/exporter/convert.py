#!/usr/bin/env python3
"""AE dump (exporter/dump/*.json) -> optimized Lottie .json + dotLottie .lottie per comp.
usage: convert.py [--only SUBSTR] [--dump DIR] [--sizes FILE]
  --dump dump_icons  the icon heroes ("Occasion sets (icons 18 Nov)", 20 Nov 2026): the nested icon comp becomes a precomp
                     asset with its own layers; its parts are resampled to the largest size they are drawn at in the hero
                     (kept at full size when that is not smaller); output names drop the " \u00b7 icons" suffix, so they are
                     the same files as the flat-illustration heroes."""
import json, glob, os, sys, io, re, base64, zipfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DUMP = os.path.join(HERE, sys.argv[sys.argv.index('--dump') + 1] if '--dump' in sys.argv else 'dump')
SUFFIX = ' \u00b7 icons'
PRE_MARGIN = 300      # precomp canvas grown by this on every side (inner layers shifted, anchor shifted): AE collapses the
                      # icon layer, so nothing is clipped at the icon's 600x600 edge there; lottie clips a precomp to w x h
OUT = os.path.join(os.path.dirname(HERE), 'export')
FPS = 60.0

OCC = {'Default': ('00 Default', 'default'), 'Eid': ('01 Eid', 'eid'), 'Birthday': ('02 Birthday', 'birthday'),
       'Baby shower': ('03 Baby shower', 'baby-shower'), 'Wedding': ('04 Wedding', 'wedding'),
       'House warming': ('05 House warming', 'house-warming'), 'Anniversary': ('06 Anniversary', 'anniversary'),
       'Other': ('07 Other', 'other')}

def rnd(o):
    if isinstance(o, float):
        r = round(o, 3)
        if r == 0: return 0
        return int(r) if r == int(r) else r
    if isinstance(o, list): return [rnd(x) for x in o]
    if isinstance(o, dict): return {k: rnd(v) for k, v in o.items()}
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
_rp = os.path.join(HERE, 'tiny_cache', 'report.json')
if os.path.exists(_rp): _TREP = json.load(open(_rp))
def png_bytes(path):
    raw = open(path, 'rb').read()
    h = hashlib.md5(raw).hexdigest()
    r = _TREP.get(h)
    if r and not r['keep_orig']:
        return open(os.path.join(HERE, 'tiny_cache', h + '.png'), 'rb').read()
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

def slugs(name):
    n = name.replace('GR hero ', '')
    if n.endswith(SUFFIX): n = n[:-len(SUFFIX)]
    screen, occ = n.rsplit(' - ', 1)
    sslug = re.sub(r'[^a-z0-9]+', '-', screen.lower()).strip('-')
    return sslug, occ

def _vals(prop):
    return [prop['k']] if not prop['a'] else [k['s'] for k in prop['k']]


def _map_prop(prop, fn):
    if prop['a']:
        for k in prop['k']: k['s'] = fn(k['s'])
    else: prop['k'] = fn(prop['k'])


def shift_pos(ks, dx, dy):
    p = ks['p']
    if p.get('s'):
        _map_prop(p['x'], lambda v: [v[0] + dx] if isinstance(v, list) else v + dx)
        _map_prop(p['y'], lambda v: [v[0] + dy] if isinstance(v, list) else v + dy)
    else: _map_prop(p, lambda v: [v[0] + dx, v[1] + dy] + list(v[2:]))


def max_scale(ks): return max(max(abs(v[0]), abs(v[1])) for v in _vals(ks['s'])) / 100.0



# ---- TinyPNG for the nested icon parts (--tiny; key from env TINIFY_KEY only, never stored). Same helper and quality
# guard as icons/exporter/convert_icons.py, own cache tiny_cache_icons/ (keyed by the md5 of the PNG sent).
import hashlib as _hl, urllib.request as _ur, urllib.error as _ue
TINY_ICONS = '--tiny' in sys.argv
_TC = os.path.join(HERE, 'tiny_cache_icons'); _TR = os.path.join(_TC, 'report.json')
_TREPI = json.load(open(_TR)) if os.path.exists(_TR) else {}
TINY_SENT = []
def tinify_part(raw):
    import numpy as _np
    os.makedirs(_TC, exist_ok=True)
    h = _hl.md5(raw).hexdigest(); out = os.path.join(_TC, h + '.png')
    if os.environ.get('TINY_DRY'):   # count only: what a --tiny run would send
        if not os.path.exists(out) and h not in TINY_SENT: TINY_SENT.append(h)
        return raw
    if not os.path.exists(out):
        key = os.environ.get('TINIFY_KEY')
        if not key: sys.exit('TINIFY_KEY is not set')
        auth = 'Basic ' + base64.b64encode(('api:' + key).encode()).decode()
        try:
            with _ur.urlopen(_ur.Request('https://api.tinify.com/shrink', data=raw, headers={'Authorization': auth}), timeout=120) as r:
                url = json.loads(r.read())['output']['url']; cnt = r.headers.get('Compression-Count')
        except _ue.HTTPError as e:
            if e.code == 429: sys.exit('TinyPNG monthly limit reached (429).')
            raise
        with _ur.urlopen(_ur.Request(url, headers={'Authorization': auth}), timeout=120) as r: open(out, 'wb').write(r.read())
        TINY_SENT.append(h); print('  tinypng', h[:8], 'compressions this month:', cnt, flush=True)
    if h not in _TREPI:
        A = _np.asarray(Image.open(io.BytesIO(raw)).convert('RGBA')).astype(_np.float32)
        B = _np.asarray(Image.open(out).convert('RGBA')).astype(_np.float32)
        d = _np.abs(A[..., :3] * A[..., 3:] / 255 - B[..., :3] * B[..., 3:] / 255).mean(-1)
        am = float(_np.abs(A[..., 3] - B[..., 3]).max())
        _TREPI[h] = {'orig': len(raw), 'tiny': os.path.getsize(out), 'mean': float(d.mean()), 'amax': am,
                     'keep_orig': float(d.mean()) > 2 or am > 24 or os.path.getsize(out) >= len(raw)}
        json.dump(_TREPI, open(_TR, 'w'), indent=1)
    return raw if _TREPI[h]['keep_orig'] else open(out, 'rb').read()

def icon_png(path, f):
    """Smallest PNG of the part: the file as is (already compressed in place) or resampled by f (anchor * f, scale / f)."""
    raw = open(path, 'rb').read(); im = Image.open(path)
    best = (raw, im.size, 1.0)
    if f < 0.999:
        r = im.convert('RGBA').resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.LANCZOS)
        b = io.BytesIO(); r.save(b, 'PNG', optimize=True)
        if len(b.getvalue()) < len(raw): best = (b.getvalue(), r.size, r.size[0] / im.size[0])
    if TINY_ICONS: best = (tinify_part(best[0]),) + best[1:]
    return best


def conv_precomp(pc, outer_scale, nid):
    """Nested icon comp (footage layers only) -> lottie precomp asset + its image assets."""
    lay_out, files = [], {}
    for L in pc['layers']:
        assert L['kind'] == 'footage' and L['startTime'] == 0 and L['stretch'] == 100 and L['blendNormal'] and not L['threeD'], L['name']
        assert not L['hasTrackMatte'] and not L['isTrackMatte'] and not L['parent'] and L['numMasks'] == 0 and L['numEffects'] == 0, L['name']
        ks = conv_transform(L['transform'])
        files[L['file']] = max(files.get(L['file'], 0), min(1.0, max_scale(ks) * outer_scale))
        lay_out.append((L, ks))
    imgs, aid, fac = [], {}, {}
    for fp, f in files.items():
        raw, (w, h), g = icon_png(fp, f); fac[fp] = g
        aid[fp] = '%s_%d' % (nid, len(imgs) + 1)
        imgs.append({'id': aid[fp], 'w': w, 'h': h, 'u': '', 'p': 'data:image/png;base64,' + base64.b64encode(raw).decode(), 'e': 1,
                     '_png': base64.b64encode(raw).decode(), '_srcbytes': os.path.getsize(fp)})
    layers = []
    for L, ks in lay_out:
        g = fac[L['file']]
        if g != 1.0:
            _map_prop(ks['a'], lambda v: [x * g for x in v]); _map_prop(ks['s'], lambda v: [x / g for x in v])
        shift_pos(ks, PRE_MARGIN, PRE_MARGIN)
        lay = {'ddd': 0, 'ind': L['index'], 'ty': 2, 'nm': L['name'], 'sr': 1, 'ks': ks, 'ao': 0, 'refId': aid[L['file']],
               'ip': frames(L['inPoint']), 'op': frames(L['outPoint']), 'st': 0, 'bm': 0}
        if not L['en']: lay['hd'] = True
        layers.append(lay)
    return imgs, {'id': nid, 'nm': pc['name'], 'fr': 60, 'layers': layers}


def convert(path):
    d = json.load(open(path))
    sslug, occ = slugs(d['name'])
    folder, oslug = OCC[occ]
    assets, aid, pre = [], {}, []
    layers = []
    for L in d['layers']:
        assert (L['startTime'] == 0 or L['kind'] == 'precomp') and L['stretch'] == 100 and L['blendNormal'] and not L['threeD']
        ks = conv_transform(L['transform'])
        lay = {'ddd': 0, 'ind': L['index'], 'ty': {'shape': 4, 'null': 3, 'footage': 2, 'precomp': 0}[L['kind']], 'nm': L['name'], 'sr': 1, 'ks': ks, 'ao': 0}
        if L['kind'] == 'precomp':
            assert L['collapse'] and not L['timeRemap'] and L['numMasks'] == 0 and L['numEffects'] == 0, L['name']
            nid = 'comp_%d' % (len(pre) + 1)
            imgs, pa = conv_precomp(d['precomps'][L['src']], max_scale(ks), nid)
            assets.extend(imgs); pre.append(pa)
            lay['refId'] = nid; lay['w'] = L['srcW'] + 2 * PRE_MARGIN; lay['h'] = L['srcH'] + 2 * PRE_MARGIN
            _map_prop(ks['a'], lambda v: [v[0] + PRE_MARGIN, v[1] + PRE_MARGIN] + list(v[2:]))
        if L['parent']: lay['parent'] = L['parent']
        if L['kind'] == 'footage':
            f = L['file']
            if f not in aid:
                im = Image.open(f); assert im.size == (L['srcW'], L['srcH']), (f, im.size, L['srcW'], L['srcH'])
                mime = 'image/png' if f.lower().endswith('.png') else 'image/jpeg'
                aid[f] = str(len(assets) + 1)
                assets.append({'id': aid[f], 'w': im.size[0], 'h': im.size[1], 'u': '', 'p': 'data:%s;base64,%s' % (mime, base64.b64encode(png_bytes(f) if mime == 'image/png' else open(f, 'rb').read()).decode()), 'e': 1, '_src': f})
            lay['refId'] = aid[f]
        if L['kind'] == 'shape':
            lay['shapes'] = conv_items(L['contents'])
        lay.update({'ip': frames(L['inPoint']), 'op': frames(L['outPoint']), 'st': frames(L['startTime']), 'bm': 0})
        if L['isTrackMatte']: lay['td'] = 1
        if L['hasTrackMatte']:
            assert L['matteType'] == 'ALPHA'
            lay['tt'] = 1; lay['tp'] = L['matteLayer'] if L['matteLayer'] else L['index'] - 1
        if not L['en'] and not L['isTrackMatte']: lay['hd'] = True
        layers.append(lay)
    # matte adjacency sanity
    for n, lay in enumerate(layers):
        if lay.get('tt'): assert layers[n - 1].get('td') == 1 and layers[n - 1]['ind'] == lay['tp'], d['name']
    anim = {'v': '5.7.0', 'fr': 60, 'ip': 0, 'op': round(d['dur'] * FPS), 'w': d['w'], 'h': d['h'], 'nm': d['name'], 'ddd': 0,
            'assets': assets + pre, 'layers': layers, 'meta': {'g': '@lottiefiles/toolkit-js 0.76.0'}}
    return anim, folder, 'gr-hero-%s-%s' % (sslug, oslug)

def dumps(o):
    return json.dumps(rnd(o), separators=(',', ':'), ensure_ascii=True)

def to_webp(asset):
    b = io.BytesIO()
    if asset.get('_png'):
        Image.open(io.BytesIO(base64.b64decode(asset['_png']))).convert('RGBA').save(b, 'WEBP', lossless=True, quality=100, method=6, exact=False)
        return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
    src = asset['_src']
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
        od = os.path.join(OUT, folder); os.makedirs(od, exist_ok=True)
        a1 = json.loads(json.dumps(anim))
        for a in a1['assets']:
            for k in ('_src', '_png', '_srcbytes'): a.pop(k, None)
        js = dumps(a1)
        open(os.path.join(od, base + '.json'), 'w').write(js)
        a2 = json.loads(json.dumps(anim))
        for a in a2['assets']:
            if 'layers' in a: continue
            a['p'] = to_webp(a)
            for k in ('_src', '_png', '_srcbytes'): a.pop(k, None)
        js2 = dumps(a2)
        manifest = '{"generator":"LottieFiles dotLottie Exporter 0.1","animations":[{"loop":false,"themeColor":"#ffcc00","speed":1.0,"id":"%s"}],"version":"1.0","author":"LottieFiles"}' % base
        with zipfile.ZipFile(os.path.join(od, base + '.lottie'), 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            z.writestr('manifest.json', manifest); z.writestr('animations/%s.json' % base, js2)
        rows.append((folder, base, len(js), os.path.getsize(os.path.join(od, base + '.lottie'))))
        print(folder, base, len(js), rows[-1][3], '%.0f%%' % (100.0 * rows[-1][3] / len(js)))
    sizes = sys.argv[sys.argv.index('--sizes') + 1] if '--sizes' in sys.argv else 'sizes.json'
    json.dump(rows, open(os.path.join(HERE, sizes), 'w')) if not only else None

main()
if TINY_ICONS: print('tinypng parts sent this run:', len(TINY_SENT))
