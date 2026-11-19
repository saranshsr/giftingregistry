"""Snap every part of the asset pack onto its original reference icon.

The pack's Asset_Manifest boxes are approximate (regenerated parts, non-uniform box sizes). For each part we search a
uniform scale + offset around the manifest box that best matches the reference: score = mean colour distance between
the part and the reference over the part's opaque pixels that are NOT covered by a part stacked in front of it.

Out: gen/placement.json  {icon: [{name, file, x, y, s}]}  — (x, y) = top-left of the full PNG in the 600 comp, s = scale.
Stacking (front → back) is decided here, not taken from the manifest (its order is mixed).
"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets')
OUT = os.path.join(os.path.dirname(__file__), 'placement.json')

# front → back
ORDER = {
    'Registry_Name': ['Registry_Name_Pen', 'Registry_Name_Iridescent_Cross', 'Registry_Name_Ring', 'Registry_Name_Tag',
                      'Registry_Name_Green_Sparkle', 'Registry_Name_Silver_Sparkle'],
    'Occasion': ['Occasion_Purple_Cross', 'Occasion_Canister', 'Occasion_Spray_Inner_Left', 'Occasion_Spray_Inner_Right',
                 'Occasion_Spray_Left', 'Occasion_Spray_Right', 'Occasion_Large_Sparkle', 'Occasion_Left_Sparkle',
                 'Occasion_Right_Sparkle', 'Occasion_Purple_Capsule_Left', 'Occasion_Cyan_Capsule_Right',
                 'Occasion_Cyan_Capsule_Left', 'Occasion_Purple_Capsule_Right', 'Occasion_Sphere_Left',
                 'Occasion_Sphere_Right', 'Occasion_Sphere_Bottom'],
    'Date': ['Date_Iridescent_Cross', 'Date_Hanging_Tag', 'Date_Connector_Ring', 'Date_Ring_Left', 'Date_Ring_Right',
             'Date_Calendar'],
    'Name': ['Name_Plus', 'Name_Badge_Disc', 'Name_Front_Person', 'Name_Rear_Person'],
    'Due_Date': ['Due_Date_Iridescent_Cross', 'Due_Date_Page_Sparkle', 'Due_Date_Ring_Left', 'Due_Date_Ring_Right',
                 'Due_Date_Calendar', 'Due_Date_Balloon_String', 'Due_Date_Large_Sparkle', 'Due_Date_Small_Sparkle'],
    'Address': ['Address_Flag', 'Address_Pin', 'Address_Map', 'Address_Green_Sparkle', 'Address_Silver_Sparkle'],
}


def load(p):
    return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255.0


def place(im, s, x, y, size=600):
    """Resize full PNG by s and paste at (x, y) into a size×size RGBA float canvas."""
    h, w = im.shape[:2]
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    pil = Image.fromarray((im * 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS)
    a = np.asarray(pil).astype(np.float32) / 255.0
    can = np.zeros((size, size, 4), np.float32)
    x0, y0 = round(x), round(y)
    sx0, sy0 = max(0, -x0), max(0, -y0)
    dx0, dy0 = max(0, x0), max(0, y0)
    dx1, dy1 = min(size, x0 + nw), min(size, y0 + nh)
    if dx1 > dx0 and dy1 > dy0:
        can[dy0:dy1, dx0:dx1] = a[sy0:sy0 + dy1 - dy0, sx0:sx0 + dx1 - dx0]
    return can


def main():
    man = json.load(open(os.path.join(ROOT, 'Asset_Manifest.json')))
    out = {}
    for icon in man:
        name = icon['name']
        ref = load(os.path.join(ROOT, 'Original_References', name + '.png'))
        refpre = ref[..., :3] * ref[..., 3:4]
        byname = {L['name']: L for L in icon['layers']}
        cover = np.zeros((600, 600), np.float32)  # opacity of parts already placed in front
        res = []
        for lname in ORDER[name]:
            L = byname[lname]
            im = load(os.path.join(ROOT, L['file']))
            h, w = im.shape[:2]
            bx, by, bw, bh = L['box']
            # manifest box ≈ the content (PNG minus its 8 px padding); start from the mean of both axes
            s0 = ((bw / (w - 16)) + (bh / (h - 16))) / 2
            cx, cy = bx + bw / 2, by + bh / 2
            best = None
            def score(s, dx, dy):
                x = cx + dx - w * s / 2
                y = cy + dy - h * s / 2
                p = place(im, s, x, y)
                wgt = p[..., 3] * (1 - cover)
                if wgt.sum() < 1:
                    return 9, x, y, p
                d = np.abs(p[..., :3] * p[..., 3:4] - refpre).sum(-1) + np.abs(p[..., 3] - ref[..., 3]) * 2
                return float((d * wgt).sum() / wgt.sum()), x, y, p
            # coarse → fine
            for span_s, span_d, step_d, n_s in ((0.16, 24, 4, 9), (0.04, 4, 1, 9)):
                ss = s0 if best is None else best[1]
                dx0 = 0 if best is None else best[2]
                dy0 = 0 if best is None else best[3]
                for s in np.linspace(ss * (1 - span_s), ss * (1 + span_s), n_s):
                    for dx in np.arange(dx0 - span_d, dx0 + span_d + 1, step_d):
                        for dy in np.arange(dy0 - span_d, dy0 + span_d + 1, step_d):
                            sc, x, y, p = score(s, dx, dy)
                            if best is None or sc < best[0]:
                                best = (sc, s, dx, dy, x, y, p)
            sc, s, dx, dy, x, y, p = best
            cover = cover + p[..., 3] * (1 - cover)
            res.append({'name': lname, 'file': L['file'], 'x': round(x, 2), 'y': round(y, 2), 's': round(float(s), 5),
                        'err': round(sc, 4)})
            print(f'{name:14s} {lname:34s} s={s:.3f} d=({dx:+.0f},{dy:+.0f}) err={sc:.3f}', flush=True)
        out[name] = res
    json.dump(out, open(OUT, 'w'), indent=1)


if __name__ == '__main__':
    main()
