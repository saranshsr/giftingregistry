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
- `_test/` holds the approved one-off test export, not part of the set.


## 00 Default

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-default` | 127.5 KB | 54.3 KB |

## 01 Eid

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-eid` | 130.7 KB | 56.2 KB |
| `gr-hero-1-3-when-is-it-eid` | 89.2 KB | 37.8 KB |
| `gr-hero-1-4-delivery-details-eid` | 105.6 KB | 42.6 KB |
| `gr-hero-2-3-whose-is-it-eid` | 95.3 KB | 32.1 KB |
| `gr-hero-name-your-registry-eid` | 126.8 KB | 46.6 KB |

## 02 Birthday

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-birthday` | 131.0 KB | 56.2 KB |
| `gr-hero-1-3-when-is-it-birthday` | 89.9 KB | 38.1 KB |
| `gr-hero-1-4-delivery-details-birthday` | 105.9 KB | 43.2 KB |
| `gr-hero-2-3-whose-is-it-birthday` | 95.3 KB | 32.8 KB |
| `gr-hero-name-your-registry-birthday` | 128.6 KB | 47.1 KB |

## 03 Baby shower

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-baby-shower` | 131.3 KB | 56.3 KB |
| `gr-hero-1-3-when-is-it-baby-shower` | 89.6 KB | 37.9 KB |
| `gr-hero-1-4-delivery-details-baby-shower` | 107.0 KB | 43.0 KB |
| `gr-hero-2-3-whose-is-it-baby-shower` | 99.6 KB | 32.8 KB |
| `gr-hero-2-5-due-date-baby-shower` | 130.0 KB | 50.0 KB |
| `gr-hero-name-your-registry-baby-shower` | 128.0 KB | 47.3 KB |

## 04 Wedding

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-wedding` | 130.0 KB | 56.0 KB |
| `gr-hero-1-3-when-is-it-wedding` | 88.8 KB | 37.9 KB |
| `gr-hero-1-4-delivery-details-wedding` | 105.1 KB | 42.5 KB |
| `gr-hero-2-3-whose-is-it-wedding` | 91.3 KB | 31.4 KB |
| `gr-hero-name-your-registry-wedding` | 126.7 KB | 46.5 KB |

## 05 House warming

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-house-warming` | 130.7 KB | 56.2 KB |
| `gr-hero-1-3-when-is-it-house-warming` | 89.4 KB | 37.9 KB |
| `gr-hero-1-4-delivery-details-house-warming` | 106.1 KB | 42.7 KB |
| `gr-hero-2-3-whose-is-it-house-warming` | 103.5 KB | 32.8 KB |
| `gr-hero-name-your-registry-house-warming` | 127.0 KB | 46.7 KB |

## 06 Anniversary

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-anniversary` | 130.0 KB | 56.1 KB |
| `gr-hero-1-3-when-is-it-anniversary` | 88.8 KB | 37.9 KB |
| `gr-hero-1-4-delivery-details-anniversary` | 105.1 KB | 42.5 KB |
| `gr-hero-2-3-whose-is-it-anniversary` | 99.3 KB | 32.0 KB |
| `gr-hero-name-your-registry-anniversary` | 126.7 KB | 46.5 KB |

## 07 Other

| file | .json | .lottie |
|---|---|---|
| `gr-hero-1-1-occasion-other` | 131.0 KB | 56.3 KB |
| `gr-hero-1-3-when-is-it-other` | 89.8 KB | 38.2 KB |
| `gr-hero-1-4-delivery-details-other` | 106.2 KB | 43.0 KB |
| `gr-hero-2-3-whose-is-it-other` | 94.7 KB | 32.4 KB |
| `gr-hero-name-your-registry-other` | 128.2 KB | 47.5 KB |

Total: 4.01 MB json, 1.58 MB lottie (39% of json).
Before TinyPNG: 5.29 MB json, 1.96 MB lottie. After: json -24%, lottie -19%.
