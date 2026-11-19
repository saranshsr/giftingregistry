#!/usr/bin/env python3
"""Web player for the icon motion (the spec sheet's live preview): gen/icons.json -> proto/.

proto/motion.json  same keys as the AE comps (one motion source), per icon and layer
proto/img/*.png    each part resampled to its size in the 600 comp (the player shows the comp at 360 px = sharp at 2x)
proto/assets/lottie/*.lottie (+ .json previews)  the exported lotties, for the spec's Assets sheet
"""
import json, os, shutil
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
P = os.path.join(ROOT, 'proto'); IMG = os.path.join(P, 'img'); LOT = os.path.join(P, 'assets', 'lottie')
for d in (IMG, LOT): os.makedirs(d, exist_ok=True)
D = json.load(open(os.path.join(HERE, 'icons.json')))


def src(f): return os.path.join(ROOT, f if f.startswith('art/') else 'assets/' + f)


out = {'dur': D['dur'], 'icons': []}
done = {}
for ic in D['icons']:
    layers = []
    for L in ic['layers']:
        key = (L['file'], L['s'])
        if key not in done:
            im = Image.open(src(L['file'])).convert('RGBA')
            w, h = max(1, round(im.width * L['s'])), max(1, round(im.height * L['s']))
            name = os.path.basename(L['file']).rsplit('.', 1)[0] + '.png'
            im.resize((w, h), Image.LANCZOS).save(os.path.join(IMG, name), optimize=True)
            done[key] = (name, w, h)
        name, w, h = done[key]
        layers.append({'name': L['name'], 'img': 'img/' + name, 'x': L['x'], 'y': L['y'], 'w': w, 'h': h, 'pivot': L['pivot'],
                       'tracks': {k: L[k] for k in ('dx', 'dy', 'sc', 'rot', 'op') if k in L}, 'doc': L['doc']})
    out['icons'].append({'slug': ic['slug'], 'comp': ic['comp'], 'layers': layers})
json.dump(out, open(os.path.join(P, 'motion.json'), 'w'), separators=(',', ':'))

# exported lotties (whatever exists now) for the Assets sheet
EXP = os.path.join(ROOT, 'export')
for f in sorted(os.listdir(EXP)):
    if f.endswith('.lottie') or f.endswith('.json'):
        shutil.copy2(os.path.join(EXP, f), os.path.join(LOT, f))
print(len(out['icons']), 'icons,', len(done), 'images,', 'lotties:', sorted(x for x in os.listdir(LOT) if x.endswith('.lottie')))
