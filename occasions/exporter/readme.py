#!/usr/bin/env python3
"""Regenerate ../export/README.md from the files on disk (+ the flat-illustration set totals from sizes.json)."""
import os, json, glob
HERE = os.path.dirname(os.path.abspath(__file__)); EXP = os.path.join(os.path.dirname(HERE), 'export')
old = json.load(open(os.path.join(HERE, 'sizes.json')))          # the flat-illustration set (17 Nov)
oj = sum(r[2] for r in old); ol = sum(r[3] for r in old)
L = ['# Gift Registry hero lotties, per occasion', '',
     '37 hero animations, one `.json` (minified, images embedded base64) and one `.lottie` (dotLottie v1, images as WebP) per comp, grouped by occasion.', '',
     '- Canvas 1125x528, 60 fps, 204 frames (3.4 s), no background.',
     '- Play once, rest on the last frame (loop: false in the .lottie manifest; set loop off in your player for the .json).',
     '- Generated from the After Effects comps by `../exporter/` (dump.jsx -> tinify.py -> convert.py), verified against AE stills with lottie-web (see exporter/diff.py).',
     '- Embedded PNGs are compressed with TinyPNG (`exporter/tinify.py`, cache in `exporter/tiny_cache/`); JPEGs are untouched.',
     '  The per-occasion title gradient pictures added on 17 Nov 2026 are not TinyPNG-compressed yet (no key at export time).',
     '- 17 Nov 2026: the "illustration" layer sits at a fixed 0.25 deg so dotLottie (ThorVG) never switches image raster path',
     '  when the rig rotation lands on exactly 0 (that switch was a ~1 px pop at frame 80); the star bits on 1.1 and 2.5 got',
     '  the same +0.25 deg (scale keys untouched, so the app\'s star pulse is unchanged). Title gradient per occasion:',
     '  #000000 -> occasion colour (Figma themes board 575:158585; `../gen/title_grad_occ.py`); Default keeps its blue.',
     '- 20 Nov 2026: every hero now uses the layered 18 Nov icon animation instead of the flat illustration (AE comps',
     '  "Occasion sets (icons 18 Nov)/<NN>/... \u00b7 icons", built by `../gen/gen_occ_icons.py`, placed by `../gen/fit_icons.py`).',
     '  The icon comp is a precomp asset inside each file (same file names as before). Its parts are embedded as they are',
     '  (the footage was compressed in place) or resampled to the size they are drawn at, whichever is smaller; no TinyPNG.',
     '  Export: dump.jsx (DUMP_ROOT) -> convert.py --dump dump_icons; verified with render.mjs + diff.py (TAG=icons) and',
     '  render_dotlottie.mjs (ThorVG).',
     '- `_test/` holds the approved one-off test export, not part of the set.', '']
tj = tl = 0
for d in sorted(os.listdir(EXP)):
    dp = os.path.join(EXP, d)
    if not os.path.isdir(dp) or d.startswith('_'): continue
    L += ['', '## ' + d, '', '| file | .json | .lottie |', '|---|---|---|']
    for f in sorted(glob.glob(os.path.join(dp, '*.json'))):
        b = os.path.basename(f)[:-5]; lo = os.path.join(dp, b + '.lottie')
        sj, sl = os.path.getsize(f), os.path.getsize(lo); tj += sj; tl += sl
        L.append('| `%s` | %.1f KB | %.1f KB |' % (b, sj / 1024, sl / 1024))
L += ['', 'Total: %.2f MB json, %.2f MB lottie (%d%% of json).' % (tj / 2**20, tl / 2**20, round(100 * tl / tj)),
      'Flat-illustration set (17 Nov): %.2f MB json, %.2f MB lottie. Icon set: json x%.2f, lottie x%.2f.' % (oj / 2**20, ol / 2**20, tj / oj, tl / ol), '']
open(os.path.join(EXP, 'README.md'), 'w').write('\n'.join(L))
print(tj, tl, oj, ol)
