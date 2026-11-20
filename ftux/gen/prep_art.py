#!/usr/bin/env python3
"""GR FTUX "What is a Gift Registry?" lottie: art prep (Figma file Zs6qEAZ1Uaej4LcKst0sbp, card 843:763418, 351 x 481.45 pt).
Everything is at 3x in card pixels (1 pt = 3 px, card top-left = 0,0).

Inputs (../figma/, downloaded with the Figma MCP download_assets at scale 3):
  onboarding_bg_3x.png  843:763446 "Onboarding background" as the 206-pt hero clips it (1053 x 618). The MCP export bakes the
                        card's r16 corners as #424242; they are filled with the neighbouring sky (the sheet's own r16 clip
                        is the only corner, as in the proto's hero-bg-full.jpg).
  cols_3x.png           843:763454 the three columns + dividers (1053 x 527, card y 218), drawn on the white card.
Rays: the GyroQR "skin_confirm_rays" .lottie unzipped (data only) - its four webp beams, recoloured to a cool white.

The column pieces are white-keyed: alpha and colour are solved so that the piece composited over white reproduces the
Figma pixel exactly (the lottie sits on the white sheet), and nothing paints a white box over its neighbours while moving.
Text is solved against its own ink (#1D2539) so the glyphs are one flat colour with clean alpha.

    python3 prep_art.py [rays_dir]  ->  ../art/*.png|jpg + ../art/prep.json"""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
FIG = os.path.join(ROOT, 'figma'); ART = os.path.join(ROOT, 'art'); os.makedirs(ART, exist_ok=True)
RAYS = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('RAYS_DIR', '')
S = 3
COLS_Y = 218 * S            # 843:763454 top in card px
INK = np.array([29, 37, 57], np.float32)   # body text colour measured in the export (#1D2539)
RAY_TINT = (238, 244, 255)  # cool white: the beams read as light on the blue sky instead of milk


def load(p): return np.asarray(Image.open(p).convert('RGB')).astype(np.float32)


def save_rgba(a, name):
    Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(ART, name), optimize=True)


def white_key(rgb, T=None, ink=None, dead=2.0):
    """alpha + colour such that colour*a + 255*(1-a) == rgb. ink: solve against one known colour (text); else a = darkness/T."""
    d = 255.0 - rgb
    if ink is not None:
        a = np.clip((d / np.maximum(255.0 - ink, 1)).max(-1), 0, 1)
    else:
        a = np.clip(d.max(-1) / T, 0, 1)
    a[d.max(-1) <= dead] = 0
    col = np.where(a[..., None] > 0, 255.0 - d / np.maximum(a[..., None], 1e-6), 0)
    if ink is not None:   # flat ink where it is solid (removes jpeg/AA noise in the colour plane)
        col = np.where(a[..., None] > 0.25, ink, col)
    return np.dstack([np.clip(col, 0, 255), a * 255.0])


info = {'scale': S, 'card_pt': [351, 481.4545], 'cta_top_pt': 417.4545, 'pieces': {}}

# ---------------------------------------------------------------- hero background
bg = load(os.path.join(FIG, 'onboarding_bg_3x.png'))
H, W = bg.shape[:2]
assert (W, H) == (1053, 618), (W, H)
clean = (bg[..., 2] >= 243) & (bg[..., 0] >= 150)       # sky pixels (the baked corner grey has b = 66)
fixed = 0
for y in range(0, 100):
    for side in (1, -1):
        xs = range(0, 120) if side == 1 else range(W - 1, W - 121, -1)
        x0 = None
        for x in xs:
            if clean[y, x] and clean[y, x + side] and clean[y, x + 2 * side]:
                x0 = x; break
        if x0 is None: continue
        src = bg[y, x0 + 2 * side].copy()
        rng = range(0, x0 + 2) if side == 1 else range(x0 - 1, W)
        for x in rng: bg[y, x] = src; fixed += 1
# tagged sRGB: untagged JPEGs get a colour conversion in this AE project (red -5 in the sky), PNGs and browsers do not
from PIL import ImageCms
SRGB = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
Image.fromarray(np.clip(bg + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(ART, 'hero_bg.jpg'), quality=92, subsampling=0, optimize=True, icc_profile=SRGB)
# AE gets the lossless PNG (this AE decodes JPEGs with a colour shift: sky red -5, which browsers and ThorVG do not do);
# the exported lottie embeds the JPEG (convert.py swaps it in via 'export_as'), 28 KB instead of 270 KB, mean error 0.47/255
Image.fromarray(np.clip(bg + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(ART, 'hero_bg.png'), optimize=True)
grey_left = int((np.abs(bg - 66).sum(-1) < 6).sum())
info['pieces']['hero_bg'] = {'file': 'hero_bg.png', 'export_as': 'hero_bg.jpg', 'x': 0, 'y': 0, 'w': W, 'h': H, 'filled_px': fixed, 'grey_left': grey_left}
print('hero bg: filled', fixed, 'px; grey left', grey_left)

# ---------------------------------------------------------------- columns
cols = load(os.path.join(FIG, 'cols_3x.png'))
assert cols.shape[1] == 1053
for i in range(3):
    x0 = 351 * i
    # icon: node 56 x 53.45 at (30.5, 8) in the column frame -> px (91.5, 24); crop a little wider, integer px
    boxes = {'ico': (x0 + 86, 18, x0 + 266, 192, dict(T=192.0)),
             'num': None,
             'txt': (x0 + 30, 320, x0 + 321, 474, dict(ink=INK))}
    nw = (255 - cols).max(-1)
    band = nw[210:300, x0 + 8:x0 + 343]
    xs = np.where(band.max(0) > 2)[0]
    boxes['num'] = (int(x0 + 8 + xs.min() - 6), 210, int(x0 + 8 + xs.max() + 7), 300, dict(T=227.0))
    for k, (l, t, r, b, kw) in boxes.items():
        crop = cols[t:b, l:r]
        # the crop must start and end on white (nothing cut off)
        edge = np.concatenate([nw[t, l:r], nw[b - 1, l:r], nw[t:b, l], nw[t:b, r - 1]])
        assert edge.max() <= 3, (i, k, edge.max())
        piece = white_key(crop, **kw)
        name = '%s%d.png' % (k, i + 1)
        save_rgba(piece, name)
        # check: over white == figma
        a = piece[..., 3:] / 255.0
        err = np.abs(piece[..., :3] * a + 255 * (1 - a) - crop).mean()
        info['pieces']['%s%d' % (k, i + 1)] = {'file': name, 'x': l, 'y': COLS_Y + t, 'w': r - l, 'h': b - t, 'err_over_white': round(float(err), 3)}
        print(name, info['pieces']['%s%d' % (k, i + 1)])

# divider (843:763459 / 843:763464): 1 pt #F2F3F7 stroke, round caps, x 117 / 234, y 231.727 -> 371.727 pt
info['dividers'] = [{'x': 117 * S, 'y0': (218 + 13.727272) * S, 'y1': (218 + 13.727272 + 140) * S, 'w': 1 * S, 'color': [242, 243, 247]},
                    {'x': 234 * S, 'y0': (218 + 13.727272) * S, 'y1': (218 + 13.727272 + 140) * S, 'w': 1 * S, 'color': [242, 243, 247]}]

# ---------------------------------------------------------------- rays (recoloured beams)
if RAYS:
    for n in 'abcd':
        im = np.asarray(Image.open(os.path.join(RAYS, 'images', 'ray_%s.webp' % n)).convert('RGBA')).astype(np.float32)
        lum = im[..., :3].mean(-1, keepdims=True) / 255.0
        im[..., :3] = np.array(RAY_TINT, np.float32) * lum
        save_rgba(im, 'ray_%s.png' % n)
        info['pieces']['ray_%s' % n] = {'file': 'ray_%s.png' % n, 'w': im.shape[1], 'h': im.shape[0]}
    src = json.load(open(os.path.join(RAYS, 'animations', 'confirm_rays.json')))
    json.dump(src, open(os.path.join(ART, 'rays_source.json'), 'w'))       # the keyframes, kept as data for gen_build
    print('rays recoloured', RAY_TINT)
json.dump(info, open(os.path.join(ART, 'prep.json'), 'w'), indent=1)
