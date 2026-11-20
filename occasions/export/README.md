# Gift Registry hero lotties, per occasion

37 hero animations, one `.json` (minified, images embedded base64) and one `.lottie` (dotLottie v1, images as WebP) per comp, grouped by occasion.

- Canvas 1125x528, 60 fps, 204 frames (3.4 s), no background.
- Play once, rest on the last frame (loop: false in the .lottie manifest; set loop off in your player for the .json).
- Generated from the After Effects comps by `../exporter/` (dump.jsx -> tinify.py -> convert.py), verified against AE stills with lottie-web (see exporter/diff.py).
- Embedded PNGs are compressed with TinyPNG (`exporter/tinify.py`, cache in `exporter/tiny_cache/`); JPEGs are untouched.
  The per-occasion title gradient pictures added on 17 Nov 2026 are not TinyPNG-compressed yet (no key at export time).
- 17 Nov 2026: the "illustration" layer sits at a fixed 0.25 deg so dotLottie (ThorVG) never switches image raster path
  when the rig rotation lands on exactly 0 (that switch was a ~1 px pop at frame 80); the star bits on 1.1 and 2.5 got
  the same +0.25 deg (scale keys untouched, so the app's star pulse is unchanged). Title gradient per occasion:
  #000000 -> occasion colour (Figma themes board 575:158585; `../gen/title_grad_occ.py`); Default keeps its blue.
- 20 Nov 2026: every hero now uses the layered 18 Nov icon animation instead of the flat illustration (AE comps
  "Occasion sets (icons 18 Nov)/<NN>/... · icons", built by `../gen/gen_occ_icons.py`, placed by `../gen/fit_icons.py`).
  The icon comp is a precomp asset inside each file (same file names as before). Its parts are embedded as they are
  (the footage was compressed in place) or resampled to the size they are drawn at, whichever is smaller; no TinyPNG.
  Export: dump.jsx (DUMP_ROOT) -> convert.py --dump dump_icons; verified with render.mjs + diff.py (TAG=icons) and
  render_dotlottie.mjs (ThorVG).
- `_test/` holds the approved one-off test export, not part of the set.


## 00 Default

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-default` | 303.0 KB | 128.2 KB |

## 01 Eid

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-eid` | 305.0 KB | 129.6 KB |
| `gr-hero-1-3-when-is-it-eid` | 300.7 KB | 135.9 KB |
| `gr-hero-1-4-delivery-details-eid` | 203.0 KB | 86.4 KB |
| `gr-hero-2-3-whose-is-it-eid` | 307.2 KB | 120.2 KB |
| `gr-hero-name-your-registry-eid` | 293.3 KB | 126.6 KB |

## 02 Birthday

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-birthday` | 305.5 KB | 129.8 KB |
| `gr-hero-1-3-when-is-it-birthday` | 301.6 KB | 136.5 KB |
| `gr-hero-1-4-delivery-details-birthday` | 204.1 KB | 87.1 KB |
| `gr-hero-2-3-whose-is-it-birthday` | 307.1 KB | 121.2 KB |
| `gr-hero-name-your-registry-birthday` | 294.8 KB | 127.5 KB |

## 03 Baby shower

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-baby-shower` | 305.1 KB | 129.6 KB |
| `gr-hero-1-3-when-is-it-baby-shower` | 300.6 KB | 135.8 KB |
| `gr-hero-1-4-delivery-details-baby-shower` | 203.4 KB | 86.7 KB |
| `gr-hero-2-3-whose-is-it-baby-shower` | 309.7 KB | 120.1 KB |
| `gr-hero-2-5-due-date-baby-shower` | 268.0 KB | 118.0 KB |
| `gr-hero-name-your-registry-baby-shower` | 293.7 KB | 126.8 KB |

## 04 Wedding

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-wedding` | 304.8 KB | 129.4 KB |
| `gr-hero-1-3-when-is-it-wedding` | 300.7 KB | 135.9 KB |
| `gr-hero-1-4-delivery-details-wedding` | 203.0 KB | 86.4 KB |
| `gr-hero-2-3-whose-is-it-wedding` | 303.5 KB | 119.7 KB |
| `gr-hero-name-your-registry-wedding` | 293.7 KB | 126.8 KB |

## 05 House warming

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-house-warming` | 305.1 KB | 129.6 KB |
| `gr-hero-1-3-when-is-it-house-warming` | 300.9 KB | 136.0 KB |
| `gr-hero-1-4-delivery-details-house-warming` | 203.2 KB | 86.6 KB |
| `gr-hero-2-3-whose-is-it-house-warming` | 316.8 KB | 121.6 KB |
| `gr-hero-name-your-registry-house-warming` | 291.9 KB | 125.7 KB |

## 06 Anniversary

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-anniversary` | 304.8 KB | 129.4 KB |
| `gr-hero-1-3-when-is-it-anniversary` | 300.7 KB | 135.9 KB |
| `gr-hero-1-4-delivery-details-anniversary` | 203.0 KB | 86.4 KB |
| `gr-hero-2-3-whose-is-it-anniversary` | 311.4 KB | 120.1 KB |
| `gr-hero-name-your-registry-anniversary` | 293.7 KB | 126.8 KB |

## 07 Other

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-other` | 305.1 KB | 129.6 KB |
| `gr-hero-1-3-when-is-it-other` | 302.6 KB | 136.7 KB |
| `gr-hero-1-4-delivery-details-other` | 201.7 KB | 85.7 KB |
| `gr-hero-2-3-whose-is-it-other` | 305.5 KB | 119.8 KB |
| `gr-hero-name-your-registry-other` | 293.9 KB | 126.9 KB |

Total: 10.21 MB json, 4.34 MB lottie (42% of json).
Flat-illustration set (17 Nov): 3.88 MB json, 1.56 MB lottie. Icon set: json x2.63, lottie x2.78.
