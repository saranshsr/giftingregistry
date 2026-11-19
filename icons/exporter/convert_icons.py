#!/usr/bin/env python3
"""Icon comps: AE dump (icons/exporter/dump/*.json, from dump.jsx) -> Lottie .json + dotLottie .lottie in icons/export/.

Reuses the hero exporter's property conversion (occasions/exporter/convert.py). On top of it, every image is resampled
to the largest size it is ever drawn at in the 600 comp (the asset pack's parts are ~2-3x larger than they appear), and
the layer's anchor/scale are adjusted to match, so the picture is identical and the file far smaller.
usage: convert_icons.py [--only SUBSTR]"""
import base64, hashlib, io, json, glob, os, re, sys, urllib.request, zipfile
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', 'occasions', 'exporter', 'convert.py')
ns = {'__file__': SRC, '__name__': 'hero_convert'}
code = open(SRC).read().rsplit('\nmain()', 1)[0]
exec(compile(code, SRC, 'exec'), ns)
conv_transform, dumps, FPS = ns['conv_transform'], ns['dumps'], ns['FPS']
DUMP = os.path.join(HERE, 'dump'); OUT = os.path.join(HERE, '..', 'export'); os.makedirs(OUT, exist_ok=True)
SUPER = 1.0    # extra resolution over the largest drawn size (1.0 = exactly the 600 comp's pixels at peak scale)


def slug(name): return 'gr-icon-' + re.sub(r'[^a-z0-9]+', '-', name.replace('GR icon ', '').lower()).strip('-')


def max_scale(ks):
    s = ks['s']
    vals = [s['k']] if not s['a'] else [k['s'] for k in s['k']]
    return max(max(abs(v[0]), abs(v[1])) for v in vals) / 100.0


def rescale(ks, f):
    """Image resampled by f: anchor (layer px) * f, scale / f."""
    a = ks['a']
    if a['a']:
        for k in a['k']: k['s'] = [v * f for v in k['s']]
    else: a['k'] = [v * f for v in a['k']]
    s = ks['s']
    if s['a']:
        for k in s['k']: k['s'] = [v / f for v in k['s']]
    else: s['k'] = [v / f for v in s['k']]


# ---- TinyPNG: every resampled PNG goes through api.tinify.com (key from env TINIFY_KEY only, never stored), cached by
# the md5 of the PNG sent. Quality guard as in the hero exporter: keep the untinified PNG when the result differs visibly
# (mean premultiplied diff > 2, any alpha diff > 24) or is not smaller.
CACHE = os.path.join(HERE, 'tiny_cache'); os.makedirs(CACHE, exist_ok=True)
REPORT = os.path.join(CACHE, 'report.json')
REP = json.load(open(REPORT)) if os.path.exists(REPORT) else {}
NO_TINY = '--no-tiny' in sys.argv


def tinify(raw):
    h = hashlib.md5(raw).hexdigest(); out = os.path.join(CACHE, h + '.png')
    if not os.path.exists(out):
        key = os.environ.get('TINIFY_KEY')
        if not key: sys.exit('TINIFY_KEY is not set (or pass --no-tiny for an uncompressed test build)')
        auth = 'Basic ' + base64.b64encode(('api:' + key).encode()).decode()
        r = urllib.request.Request('https://api.tinify.com/shrink', data=raw, headers={'Authorization': auth})
        try:
            with urllib.request.urlopen(r, timeout=120) as resp: url = json.loads(resp.read())['output']['url']; cnt = resp.headers.get('Compression-Count')
        except urllib.error.HTTPError as e:
            if e.code == 401: sys.exit('TinyPNG rejected the key (401). Put your real API key from tinypng.com/dashboard/api in TINIFY_KEY.')
            if e.code == 429: sys.exit('TinyPNG monthly limit reached (429).')
            raise
        with urllib.request.urlopen(urllib.request.Request(url, headers={'Authorization': auth}), timeout=120) as resp: open(out, 'wb').write(resp.read())
        print('  tinypng', h[:8], 'compressions this month:', cnt, flush=True)
    if h not in REP:
        A = np.asarray(Image.open(io.BytesIO(raw)).convert('RGBA')).astype(np.float32)
        B = np.asarray(Image.open(out).convert('RGBA')).astype(np.float32)
        d = np.abs(A[..., :3] * A[..., 3:] / 255 - B[..., :3] * B[..., 3:] / 255).mean(-1)
        amax = float(np.abs(A[..., 3] - B[..., 3]).max())
        REP[h] = {'orig': len(raw), 'tiny': os.path.getsize(out), 'mean': float(d.mean()), 'amax': amax,
                  'keep_orig': float(d.mean()) > 2 or amax > 24 or os.path.getsize(out) >= len(raw)}
        json.dump(REP, open(REPORT, 'w'), indent=1)
    return raw if REP[h]['keep_orig'] else open(out, 'rb').read()


def png_data(path, f, webp):
    im = Image.open(path).convert('RGBA')
    if f < 0.999: im = im.resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); raw = b.getvalue()
    if not NO_TINY: raw = tinify(raw)
    if webp:
        w = io.BytesIO(); Image.open(io.BytesIO(raw)).convert('RGBA').save(w, 'WEBP', lossless=True, quality=100, method=6, exact=False)
        return im.size, 'data:image/webp;base64,' + base64.b64encode(w.getvalue()).decode()
    return im.size, 'data:image/png;base64,' + base64.b64encode(raw).decode()


def convert(path):
    d = json.load(open(path))
    lay_out, files = [], {}
    for L in d['layers']:
        assert L['kind'] == 'footage' and L['startTime'] == 0 and L['stretch'] == 100 and L['blendNormal'] and not L['threeD']
        assert not L['hasTrackMatte'] and not L['isTrackMatte'] and not L['parent']
        ks = conv_transform(L['transform'])
        f = min(1.0, max_scale(ks) * SUPER)
        files[L['file']] = max(files.get(L['file'], 0), f)
        lay_out.append((L, ks))
    assets, aid = {'json': [], 'lottie': []}, {}
    for n, (fp, f) in enumerate(files.items()):
        aid[fp] = str(n + 1)
        for kind in ('json', 'lottie'):
            (w, h), p = png_data(fp, f, kind == 'lottie')
            assets[kind].append({'id': aid[fp], 'w': w, 'h': h, 'u': '', 'p': p, 'e': 1})
    layers = []
    for L, ks in lay_out:
        rescale(ks, files[L['file']])
        lay = {'ddd': 0, 'ind': L['index'], 'ty': 2, 'nm': L['name'], 'sr': 1, 'ks': ks, 'ao': 0, 'refId': aid[L['file']],
               'ip': L['inPoint'] * FPS, 'op': L['outPoint'] * FPS, 'st': 0, 'bm': 0}
        if not L['en']: lay['hd'] = True
        layers.append(lay)
    base = slug(d['name'])
    res = {}
    for kind in ('json', 'lottie'):
        res[kind] = {'v': '5.7.0', 'fr': 60, 'ip': 0, 'op': round(d['dur'] * FPS), 'w': d['w'], 'h': d['h'], 'nm': d['name'],
                     'ddd': 0, 'assets': assets[kind], 'layers': layers, 'meta': {'g': '@lottiefiles/toolkit-js 0.76.0'}}
    return res, base


def main():
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    for path in sorted(glob.glob(os.path.join(DUMP, '*.json'))):
        if only and only not in os.path.basename(path): continue
        res, base = convert(path)
        js = dumps(res['json'])
        open(os.path.join(OUT, base + '.json'), 'w').write(js)
        manifest = '{"generator":"LottieFiles dotLottie Exporter 0.1","animations":[{"loop":false,"themeColor":"#ffcc00","speed":1.0,"id":"%s"}],"version":"1.0","author":"LottieFiles"}' % base
        lp = os.path.join(OUT, base + '.lottie')
        with zipfile.ZipFile(lp, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            z.writestr('manifest.json', manifest); z.writestr('animations/%s.json' % base, dumps(res['lottie']))
        print(base, 'json %d KB' % (len(js) // 1024), 'lottie %d KB' % (os.path.getsize(lp) // 1024))


main()
