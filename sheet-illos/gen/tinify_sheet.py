#!/usr/bin/env python3
"""Bottom sheet lotties (copy of occasions/exporter/tinify.py, paths -> ../verify). Compress every unique PNG referenced by dump/*.json via TinyPNG. Key from env TINIFY_KEY only.
Cache: tiny_cache/<md5>.png ; quality report: tiny_cache/report.json"""
import json, glob, os, sys, hashlib, base64, io, urllib.request
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); V = os.path.join(os.path.dirname(HERE), 'verify')
CACHE = os.path.join(V, 'tiny_cache'); os.makedirs(CACHE, exist_ok=True)
KEY = os.environ.get('TINIFY_KEY')
auth = 'Basic ' + base64.b64encode(('api:' + (KEY or '')).encode()).decode()
count = None
def req(url, data=None):
    global count
    r = urllib.request.Request(url, data=data, headers={'Authorization': auth})
    with urllib.request.urlopen(r, timeout=120) as resp:
        c = resp.headers.get('Compression-Count')
        if c: count = int(c)
        return resp.read(), resp
def premul(p):
    a = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32)
    return a[..., :3] * (a[..., 3:4] / 255.0), a[..., 3]
files = {}
for p in glob.glob(os.path.join(V, 'dump', '*.json')):
    for L in json.load(open(p))['layers']:
        if L['kind'] == 'footage' and L['file'].lower().endswith('.png'): files[L['file']] = 1
byhash = {}
for f in sorted(files): byhash.setdefault(hashlib.md5(open(f, 'rb').read()).hexdigest(), []).append(f)
print('unique png', len(byhash))
rep = {}
for n, (h, fl) in enumerate(sorted(byhash.items())):
    src = fl[0]; out = os.path.join(CACHE, h + '.png')
    if not os.path.exists(out):
        if not KEY: sys.exit('no TINIFY_KEY')
        body, resp = req('https://api.tinify.com/shrink', open(src, 'rb').read())
        url = json.loads(body)['output']['url']
        data, _ = req(url)
        open(out, 'wb').write(data)
        if count and count >= 440: print('STOP near limit', count); break
    pa, aa = premul(src); pb, ab = premul(out)
    d = np.abs(pa - pb).mean(axis=2)
    amax = float(np.abs(aa - ab).max())
    r = dict(src=src, orig=os.path.getsize(src), tiny=os.path.getsize(out), mean=float(d.mean()), p995=float(np.percentile(d, 99.5)), amax=amax)
    r['keep_orig'] = r['mean'] > 2 or amax > 24 or r['tiny'] >= r['orig']
    rep[h] = r
    print(n, os.path.basename(src), r['orig'], '->', r['tiny'], 'mean %.2f p99.5 %.1f amax %d' % (r['mean'], r['p995'], amax), 'KEEP' if r['keep_orig'] else '', flush=True)
json.dump(rep, open(os.path.join(CACHE, 'report.json'), 'w'), indent=1)
print('Compression-Count', count)
