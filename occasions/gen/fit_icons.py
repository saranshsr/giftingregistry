#!/usr/bin/env python3
"""Place each 18 Nov icon comp (600x600) where the old flat hero illustration sat (20 Nov 2026).

Inputs
  ../build/icon_fit/ae/GR_icon_<screen>__f203.png   AE saveFrameToPng of the icon comp at its rest frame (203)
  ../build/icon_fit/ae/GR_hero_<screen>_...__f203.png  AE rest frame of an old hero (cross-check of the composite below)
  ../../heroes/art/<page>/hero.json + pictures      the old illustration (jpg + alpha) and its bits at rest = Figma still
  ../../heroes/figma/ref.png                        Figma 902:195436 hero frames at 3x (side-by-side check)
Method
  1. SIFT keypoints on both (premultiplied over white), ratio test, RANSAC similarity (cv2.estimateAffinePartial2D).
  2. Photometric refinement of (scale, tx, ty), rotation fixed at 0: minimise the mean |premultiplied RGBA| difference
     inside the old illustration's main object (largest connected alpha blob, dilated).
Output
  ../build/icon_fit/placement.json  {screen: {s, tx, ty, pos, scale, err...}}  hero px = s * icon px + t (pixel centres)
  ../build/icon_fit/fit_<page>.jpg  old | icon placed | overlay"""
import json, os, sys
import numpy as np, cv2
from PIL import Image
from scipy import ndimage, optimize

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
GR = os.path.dirname(ROOT); HER = os.path.join(GR, 'heroes', 'art')
FIT = os.path.join(ROOT, 'build', 'icon_fit'); AE = os.path.join(FIT, 'ae')
W, H = 1125, 528
# page -> (screen label, icon comp, AE icon still, AE old hero still)
PAGES = {
    'p5': ('1.1 Occasion', 'GR icon 1.1 Occasion', 'GR_icon_1_1_Occasion', 'GR_hero_1_1_Occasion_Birthday'),
    'p1': ('1.3 When is it', 'GR icon 1.3 When', 'GR_icon_1_3_When', 'GR_hero_1_3_When_is_it_Birthday'),
    'p2': ('1.4 Delivery details', 'GR icon 1.4 Delivery', 'GR_icon_1_4_Delivery', 'GR_hero_1_4_Delivery_details_Birthday'),
    'p3': ('2.3 Whose is it', 'GR icon 2.3 Whose', 'GR_icon_2_3_Whose', 'GR_hero_2_3_Whose_is_it_Birthday'),
    'p4': ('2.5 Due date', 'GR icon 2.5 Due date', 'GR_icon_2_5_Due_date', 'GR_hero_2_5_Due_date_Baby_shower'),
    'p6': ('Name your registry', 'GR icon Name your registry', 'GR_icon_Name_your_registry', 'GR_hero_Name_your_registry_Birthday'),
}


def put(can, im, x, y):
    ix, iy = int(np.floor(x)), int(np.floor(y)); fx, fy = x - ix, y - iy
    if fx or fy: im = im.transform(im.size, Image.AFFINE, (1, 0, -fx, 0, 1, -fy), Image.BILINEAR)
    L = Image.new('RGBA', can.size, (0, 0, 0, 0)); L.paste(im, (ix, iy)); return Image.alpha_composite(can, L)


def old_illustration(pg):
    """Old hero illustration + bits at rest, from the same pictures the AE comps use. Returns (all, main body only)."""
    Hj = json.load(open(os.path.join(HER, pg, 'hero.json'))); F = Hj['files']
    f = F['ill']; rgb = Image.open(os.path.join(HER, pg, f['file'])).convert('RGB')
    a = Image.open(os.path.join(HER, pg, F['ill_a']['file'])).convert('L')
    im = rgb.copy(); im.putalpha(a.resize(rgb.size))
    body = put(Image.new('RGBA', (W, H), (0, 0, 0, 0)), im, f['x'], f['y']); can = body
    for b in Hj['bits']:
        g = F[b['key']]; can = put(can, Image.open(os.path.join(HER, pg, g['file'])).convert('RGBA'), g['x'], g['y'])
    return np.asarray(can).astype(np.float32), np.asarray(body).astype(np.float32)


def prem(a): return a[..., :3] * a[..., 3:4] / 255.0


def gray_white(a):
    p = prem(a) + 255.0 * (1 - a[..., 3:4] / 255.0)
    return cv2.cvtColor(p.clip(0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)


def warp(icon, s, tx, ty):
    M = np.float32([[s, 0, tx], [0, s, ty]])
    p = np.dstack([prem(icon), icon[..., 3]])                 # warp premultiplied
    return cv2.warpAffine(p, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)


def to_rgba(wp):
    a = wp[..., 3:4]; rgb = np.where(a > 0, wp[..., :3] * 255.0 / np.maximum(a, 1e-6), 0)
    return np.dstack([rgb, a])


def sift_fit(icon, old):
    g1, g2 = gray_white(icon), gray_white(old)
    m1 = (icon[..., 3] > 30).astype(np.uint8) * 255; m2 = (old[..., 3] > 30).astype(np.uint8) * 255
    sift = cv2.SIFT_create(nfeatures=4000)
    k1, d1 = sift.detectAndCompute(g1, m1); k2, d2 = sift.detectAndCompute(g2, m2)
    mt = cv2.BFMatcher().knnMatch(d1, d2, k=2)
    good = [m for m, n in mt if m.distance < 0.75 * n.distance]
    src = np.float32([k1[m.queryIdx].pt for m in good]); dst = np.float32([k2[m.trainIdx].pt for m in good])
    M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=3.0, maxIters=20000, confidence=0.999)
    inl = inl.ravel().astype(bool)
    s = float(np.hypot(M[0, 0], M[1, 0])); th = float(np.degrees(np.arctan2(M[1, 0], M[0, 0])))
    return M, s, th, src[inl], dst[inl], len(good)


def main():
    out = {}
    for pg, (screen, comp, icon_png, hero_png) in PAGES.items():
        icon = np.asarray(Image.open(os.path.join(AE, icon_png + '__f203.png')).convert('RGBA')).astype(np.float32)
        old, body = old_illustration(pg)
        # cross-check: composite vs AE rest frame where the AE still shows the illustration alone (no swoosh/title on top)
        aer = np.asarray(Image.open(os.path.join(AE, hero_png + '__f203.png')).convert('RGBA')).astype(np.float32)
        dd = np.abs(prem(old) - prem(aer)).mean(-1); cm = old[..., 3] > 250
        xcheck = float(np.median(dd[cm]))
        M, s0, th, si, di, ngood = sift_fit(icon, old)
        # main object = the old illustration's biggest connected alpha blob (the bits are separate)
        lab, n = ndimage.label(body[..., 3] > 128)
        big = lab == (1 + int(np.argmax(ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)))))
        main = ndimage.binary_dilation(big, iterations=6)
        P_old = np.dstack([prem(old), old[..., 3]])

        def cost(v, mask):
            wp = warp(icon, v[0], v[1], v[2]); return float(np.abs(wp - P_old)[mask].mean())
        v0 = [s0, M[0, 2], M[1, 2]]
        r = optimize.minimize(cost, v0, args=(main,), method='Nelder-Mead',
                              options={'xatol': 1e-4, 'fatol': 1e-4, 'initial_simplex': [v0, [v0[0] * 1.01, v0[1], v0[2]], [v0[0], v0[1] + 1.5, v0[2]], [v0[0], v0[1], v0[2] + 1.5]], 'maxiter': 600})
        s, tx, ty = [float(x) for x in r.x]
        # errors
        pred = si * s + np.float32([tx, ty]); res = np.hypot(*(pred - di).T)
        wp = warp(icon, s, tx, ty)
        union = (wp[..., 3] > 8) | (old[..., 3] > 8)
        a1, a2 = wp[..., 3] > 128, old[..., 3] > 128
        iou_all = float((a1 & a2).sum() / (a1 | a2).sum())
        iou_main = float((a1 & a2 & main).sum() / ((a1 | a2) & main).sum())
        ebox = [int(v) for v in np.argwhere(wp[..., 3] > 8)[:, ::-1].min(0)] + [int(v) for v in np.argwhere(wp[..., 3] > 8)[:, ::-1].max(0)]
        obox = [int(v) for v in np.argwhere(old[..., 3] > 8)[:, ::-1].min(0)] + [int(v) for v in np.argwhere(old[..., 3] > 8)[:, ::-1].max(0)]
        # AE layer: anchor (300, 300); pixel centre mapping hero_c = s * icon_c + t, with c = index + 0.5
        t_c = (tx + 0.5 - 0.5 * s, ty + 0.5 - 0.5 * s)
        pos = [t_c[0] + 300 * s, t_c[1] + 300 * s]
        out[screen] = {'page': pg, 'icon_comp': comp, 's': s, 'tx': tx, 'ty': ty, 'pos': [round(pos[0], 3), round(pos[1], 3)],
                       'scale': round(100 * s, 4), 'sift_s': s0, 'sift_rot_deg': th, 'sift_matches': ngood, 'sift_inliers': int(len(si)),
                       'kp_rms_px': float(np.sqrt((res ** 2).mean())), 'kp_median_px': float(np.median(res)),
                       'mean_diff_main': cost([s, tx, ty], main), 'mean_diff_union': float(np.abs(wp - P_old)[union].mean()),
                       'alpha_iou_main': iou_main, 'alpha_iou_all': iou_all, 'icon_bbox': ebox, 'old_bbox': obox,
                       'composite_vs_ae_median': xcheck}
        o = out[screen]
        print('%-20s s %.4f (sift %.4f, rot %+.2f deg, %d/%d inliers)  pos (%.1f, %.1f)  kp rms %.2f px  main |d| %.2f  IoU main %.3f all %.3f  bbox icon %s old %s  xcheck %.2f' % (
            screen, s, s0, th, len(si), ngood, pos[0], pos[1], o['kp_rms_px'], o['mean_diff_main'], iou_main, iou_all, ebox, obox, xcheck))
        # preview: old | icon placed | overlay (old red, icon cyan)
        ip = to_rgba(wp)
        def onw(a): return (prem(a) + 255 * (1 - a[..., 3:4] / 255)).clip(0, 255).astype(np.uint8)
        ov = np.full((H, W, 3), 255, np.uint8)
        ov[..., 0] = 255 - (wp[..., 3] > 128) * 200; ov[..., 1] = 255 - ((old[..., 3] > 128) & ~(wp[..., 3] > 128)) * 200 - ((old[..., 3] > 128) & (wp[..., 3] > 128)) * 120
        ov[..., 2] = 255 - (old[..., 3] > 128) * 200
        x0, x1 = 300, 830
        strip = np.concatenate([onw(old)[:, x0:x1], onw(ip)[:, x0:x1], ov[:, x0:x1]], 1)
        Image.fromarray(strip).resize((strip.shape[1] * 2 // 5, H * 2 // 5)).save(os.path.join(FIT, 'fit_%s.jpg' % pg), quality=45)
        Image.fromarray(np.dstack([ip.clip(0, 255).astype(np.uint8)[..., :3], wp[..., 3].clip(0, 255).astype(np.uint8)])).save(os.path.join(FIT, 'placed_%s.png' % pg))
    json.dump(out, open(os.path.join(FIT, 'placement.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
