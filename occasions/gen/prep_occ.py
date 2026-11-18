#!/usr/bin/env python3
"""Gift Registry heroes per occasion (Figma board 946:196141): only the swoosh gradient changes per occasion, plus the
2.3 title "Whose <occasion> is it?". Everything else is the page hero from ../../heroes (same art files, shared).
Input : ../../heroes/art/<page>/{hero.json, sw.png}, ../figma/titles/<occasion>.svg (Figma 2.3 title re-typed, SVG)
Output: ../art/<occasion>/<page>/hero.json (+ recoloured swoosh, 2.3 title pictures), content-hashed names."""
import copy, glob, hashlib, json, os, shutil, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
HER = os.path.join(os.path.dirname(ROOT), 'heroes')
sys.path.insert(0, os.path.join(HER, 'gen'))
import prep_heroes as ph                                  # title_art(), save_png(), cx/cy (its page loop runs only as main)

h2 = lambda s: np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], float)
GRAD = {'default': ('9dbdfc', 'c2d4f8'), 'eid': ('ffcf8d', 'ffebd1'), 'birthday': ('ff7ea9', 'ffcbdb'),
        'babyshower': ('97cfff', 'd5ebff'), 'wedding': ('ffada3', 'ffddda'), 'housewarming': ('ffc092', 'ffe5d3'),
        'anniversary': ('ffada3', 'ffddda'), 'other': ('ffc68d', 'ffe8d1')}
SRC = {'p5': 'default', 'p1': 'birthday', 'p2': 'birthday', 'p3': 'birthday', 'p6': 'birthday', 'p4': 'babyshower'}  # what Figma drew
LABEL = {'default': 'Default', 'eid': 'Eid', 'birthday': 'Birthday', 'babyshower': 'Baby shower', 'wedding': 'Wedding',
         'housewarming': 'House warming', 'anniversary': 'Anniversary', 'other': 'Other'}
TITLE = {'eid': 'Whose Eid ul fitr is it?', 'birthday': 'Whose birthday is it?', 'babyshower': 'Whose baby shower is it?',
         'wedding': 'Whose wedding is it?', 'housewarming': 'Whose housewarming is it?', 'anniversary': 'Whose anniversary is it?',
         'other': 'Whose occasion is it?'}
# 2.3 title render bounds relative to the text box (Figma): x, y, w, h. The text box is fixed (374 wide, centred), so
# the hero-frame position is p3's (58.3, 78.3) shifted by the change against birthday (58.303, -9.68).
REL = {'eid': (54.35, -9.68), 'babyshower': (27.162, -8.4), 'wedding': (57.006, -9.68), 'housewarming': (12.787, -9.68),
       'anniversary': (34.568, -9.68), 'other': (56.021, -9.68), 'birthday': (58.303, -9.68)}
PAGES_ALL = ['p5', 'p3', 'p6', 'p1', 'p2']                # 1.1 occasion, 2.3 whose, name, 1.3 date, 1.4 delivery
PLAN = {o: PAGES_ALL + (['p4'] if o == 'babyshower' else []) for o in TITLE}
PLAN['default'] = ['p5']


def recolour(src_png, frm, to):
    a = np.asarray(Image.open(src_png).convert('RGBA'), float)
    c0, c1 = h2(GRAD[frm][0]), h2(GRAD[frm][1]); v = c1 - c0
    t = np.clip(((a[..., :3] - c0) @ v) / (v @ v), 0, 1)
    n0, n1 = h2(GRAD[to][0]), h2(GRAD[to][1])
    rgb = n0 + t[..., None] * (n1 - n0)
    return Image.fromarray(np.dstack([rgb.round(), a[..., 3]]).astype(np.uint8))


def hashed(D, f):
    src = os.path.join(D, f['file']); h = hashlib.md5(open(src, 'rb').read()).hexdigest()[:8]
    base, ext = os.path.splitext(f['file']); new = '%s.%s%s' % (base, h, ext)
    shutil.copyfile(src, os.path.join(D, new)); f['file'] = new


for occ, pages in PLAN.items():
    for pg in pages:
        BD = os.path.join(HER, 'art', pg); D = os.path.join(ROOT, 'art', occ, pg); os.makedirs(D, exist_ok=True)
        for old in glob.glob(os.path.join(D, 'gr_*.*.*')): os.remove(old)
        H = copy.deepcopy(json.load(open(os.path.join(BD, 'hero.json'))))
        for k, f in H['files'].items(): f['path'] = os.path.join(BD, f['file']); f['shared'] = True    # base art, shared
        own = []
        # swoosh in this occasion's gradient (exact: every Figma swoosh pixel sits on its own 2-stop gradient)
        sw = recolour(os.path.join(BD, 'sw.png'), SRC[pg], occ); ph.save_png(sw, os.path.join(D, 'gr_sw.png'))
        H['files']['sw'] = dict(H['files']['sw'], file='gr_sw.png'); own.append('sw')
        if pg == 'p3':
            rx, ry = REL[occ]; trb = (58.3 + rx - 58.303, 78.3 + ry + 9.68)
            spec_ = {'files': {}}
            ph.title_art(D, open(os.path.join(ROOT, 'figma', 'titles', occ + '.svg')).read(), trb, 2, spec_)
            H['title'] = spec_['title']; H['title_lines'] = spec_['title_lines']
            for k in ('title_grad', 'title_shadow'): H['files'][k] = spec_['files'][k]; own.append(k)
            H['title_text'] = '2.3 ' + TITLE[occ]
        for k in own:
            f = H['files'][k]; f.pop('path', None); f.pop('shared', None); hashed(D, f); f['path'] = os.path.join(D, f['file'])
        H['occasion'] = occ; H['occasion_label'] = LABEL[occ]; H['swoosh_grad'] = GRAD[occ]
        json.dump(H, open(os.path.join(D, 'hero.json'), 'w'))
        dots = sum(1 for p in H['title'] if len(p['outers']) > 1)
        print('%-12s %s %-34s letters %2d (multi-part %d)' % (occ, pg, H['title_text'], len(H['title']), dots))
