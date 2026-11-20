#!/usr/bin/env python3
"""Rebuild each sheet illustration exactly as Figma draws it, at 3x in the 200x120 pt Visuals box (600x360 px), transparent.

Figma draws the raw image fill through an image transform (FILL / CROP), clips it to the node rect, rotates the node
(registry: -1.98 deg) and applies image filters (exposure, contrast, highlights, shadows). The geometry is done here
from the node facts in figma_nodes.json; the filters are fitted as a cubic colour polynomial against Figma's own 4x
export of the node (which the MCP flattens on #1E1E1E: where the fill is opaque that export IS the filtered colour).

    python3 prep_art.py  ->  ../art/<card>_full.png (+ _full4x.png), ../art/prep.json, prints fit + check errors"""
import json, os, sys
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
FIG = os.path.join(ROOT, 'figma'); ART = os.path.join(ROOT, 'art'); os.makedirs(ART, exist_ok=True)
N = json.load(open(os.path.join(HERE, 'figma_nodes.json')))
S = 3                      # export scale (px per pt)
BOX = (200, 120)           # Visuals box, pt
GRAY = 30.0                # MCP export background


def load(p): return np.asarray(Image.open(os.path.join(FIG, p)).convert('RGBA')).astype(np.float32)


def img_to_local(node, iw, ih):
    """3x3 matrix: raw image px -> node-local pt."""
    w, h = node['w'], node['h']
    if node['scaleMode'] in ('FILL', 'FIT'):
        s = (max if node['scaleMode'] == 'FILL' else min)(w / iw, h / ih)
        return np.array([[s, 0, (w - iw * s) / 2], [0, s, (h - ih * s) / 2], [0, 0, 1]])
    T = np.vstack([np.array(node['imageTransform']), [0, 0, 1]])          # node unit square -> image unit square
    Ti = np.linalg.inv(T)                                                  # image unit -> node unit
    return np.diag([w, h, 1]) @ Ti @ np.diag([1 / iw, 1 / ih, 1])


def local_to_box(node):
    if 'rt' in node: return np.vstack([np.array(node['rt']), [0, 0, 1]])
    return np.array([[1, 0, node['x']], [0, 1, node['y']], [0, 0, 1]])


def render(rgba, node, scale, out_wh, origin=(0, 0), K=4):
    """Premultiplied supersampled warp of the raw fill into a canvas (px = (box_pt - origin) * scale), clipped to the node rect."""
    ih, iw = rgba.shape[:2]
    M = np.diag([scale * K, scale * K, 1]) @ np.array([[1, 0, -origin[0]], [0, 1, -origin[1]], [0, 0, 1]]) @ local_to_box(node) @ img_to_local(node, iw, ih)
    pm = rgba.copy(); pm[..., :3] *= pm[..., 3:] / 255.0
    W, H = out_wh[0] * K, out_wh[1] * K
    # pre-shrink the source when it is much denser than the target so bilinear sampling does not alias
    dens = np.sqrt(abs(np.linalg.det(M[:2, :2])))
    if dens < 0.7:
        f = max(dens * 1.4, 1e-3); pm = cv2.resize(pm, (max(1, int(iw * f)), max(1, int(ih * f))), interpolation=cv2.INTER_AREA)
        M = M @ np.diag([iw / pm.shape[1], ih / pm.shape[0], 1])
    big = cv2.warpAffine(pm, M[:2], (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    # clip to the node rect
    C = np.diag([scale * K, scale * K, 1]) @ np.array([[1, 0, -origin[0]], [0, 1, -origin[1]], [0, 0, 1]]) @ local_to_box(node)
    corners = np.array([[0, 0, 1], [node['w'], 0, 1], [node['w'], node['h'], 1], [0, node['h'], 1]]).T
    pts = (C @ corners)[:2].T
    clip = np.zeros((H, W), np.float32); cv2.fillPoly(clip, [np.round(pts * 16).astype(np.int32)], 1.0, lineType=cv2.LINE_AA, shift=4)
    big *= clip[..., None]
    small = big.reshape(out_wh[1], K, out_wh[0], K, 4).mean(axis=(1, 3))
    a = small[..., 3:]
    rgb = np.where(a > 0, small[..., :3] / np.maximum(a, 1e-6) * 255.0, 0)
    return np.dstack([rgb, a])


def feats(rgb):
    x = rgb.reshape(-1, 3) / 255.0; r, g, b = x[:, 0], x[:, 1], x[:, 2]
    cols = [np.ones_like(r)]
    for d in range(1, 4):
        for i in range(d + 1):
            for j in range(d + 1 - i):
                k = d - i - j; cols.append(r ** i * g ** j * b ** k)
    return np.stack(cols, 1)


def on_gray(L): return L[..., :3] * L[..., 3:] / 255 + GRAY * (1 - L[..., 3:] / 255)


def locate(E, R4):
    """Translation of the 4x render inside Figma's export (export may be cropped to its render bounds)."""
    g1 = cv2.Canny(np.clip(E, 0, 255).astype(np.uint8), 40, 120).astype(np.float32)
    g2 = cv2.Canny(np.clip(on_gray(R4), 0, 255).astype(np.uint8), 40, 120).astype(np.float32)
    g1 = cv2.GaussianBlur(g1, (0, 0), 2); g2 = cv2.GaussianBlur(g2, (0, 0), 2)
    P = 40
    big = cv2.copyMakeBorder(g1, P, P, P, P, cv2.BORDER_CONSTANT, value=0)
    if g2.shape[0] > big.shape[0] or g2.shape[1] > big.shape[1]:
        raise SystemExit('render larger than padded export')
    res = cv2.matchTemplate(big, g2, cv2.TM_CCORR_NORMED)
    _, mx, _, loc = cv2.minMaxLoc(res)
    return loc[0] - P, loc[1] - P, mx


def bbox_pt(node):
    C = local_to_box(node)
    pts = (C @ np.array([[0, 0, 1], [node['w'], 0, 1], [node['w'], node['h'], 1], [0, node['h'], 1]]).T)[:2].T
    return pts.min(0), pts.max(0)


info = {}
for card in ('collection', 'registry'):
    node = N[card]['image']
    raw = load(node['raw'])
    E = load(node['export4x'])[..., :3]
    lo, hi = bbox_pt(node)
    o4 = np.floor(lo * 4) / 4; wh4 = (int(np.ceil((hi[0] - o4[0]) * 4)) + 2, int(np.ceil((hi[1] - o4[1]) * 4)) + 2)
    R4 = render(raw, node, 4, wh4, origin=o4)
    dx, dy, score = locate(E, R4)
    # align: crop/pad the render to the export frame
    Eh, Ew = E.shape[:2]
    A4 = np.zeros((Eh, Ew, 4), np.float32)
    ys, xs = slice(max(0, dy), min(Eh, dy + wh4[1])), slice(max(0, dx), min(Ew, dx + wh4[0]))
    A4[ys, xs] = R4[ys.start - dy:ys.stop - dy, xs.start - dx:xs.stop - dx]
    # sub-pixel refinement (the export frame is pixel-snapped): ECC translation, then re-render shifted
    g1 = cv2.cvtColor(E, cv2.COLOR_RGB2GRAY); g2 = cv2.cvtColor(on_gray(A4).astype(np.float32), cv2.COLOR_RGB2GRAY)
    wm = np.eye(2, 3, dtype=np.float32)
    _, wm = cv2.findTransformECC(g1, g2, wm, cv2.MOTION_TRANSLATION, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-7), None, 5)
    sub = (float(wm[0, 2]), float(wm[1, 2]))
    o4s = o4 + np.array(sub) / 4.0
    R4 = render(raw, node, 4, wh4, origin=o4s)
    A4[:] = 0; A4[ys, xs] = R4[ys.start - dy:ys.stop - dy, xs.start - dx:xs.stop - dx]
    lost = R4[..., 3].sum() - A4[..., 3].sum()
    # fit filters on opaque pixels (away from edges)
    solid = cv2.erode((A4[..., 3] > 249).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    aa = A4[..., 3:][solid] / 255.0
    X = feats(A4[..., :3][solid]); Y = (E[solid] - GRAY * (1 - aa)) / aa / 255.0   # un-composite the #1E1E1E
    coef, *_ = np.linalg.lstsq(X, Y, rcond=None)
    fit_err = np.abs(X @ coef - Y).mean() * 255
    ident = np.abs(A4[..., :3][solid] / 255.0 - Y).mean() * 255

    def filt(rgba):
        o = rgba.copy(); sh = o.shape
        o[..., :3] = np.clip((feats(o[..., :3]) @ coef).reshape(sh[:-1] + (3,)) * 255, 0, 255)
        return o
    rawf = filt(raw)
    F4 = render(rawf, node, 4, wh4, origin=o4s)
    B4 = np.zeros((Eh, Ew, 4), np.float32); B4[ys, xs] = F4[ys.start - dy:ys.stop - dy, xs.start - dx:xs.stop - dx]
    d = np.abs(on_gray(B4) - E).mean(2)
    # final 3x art in the Visuals box
    F3 = render(rawf, node, S, (BOX[0] * S, BOX[1] * S))
    Image.fromarray(np.clip(F3 + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(ART, card + '_full.png'))
    # premultiplied 4x check image next to export
    Image.fromarray(np.clip(np.hstack([E, on_gray(B4), np.dstack([np.clip(d * 8, 0, 255)] * 3)]), 0, 255).astype(np.uint8)).save(os.path.join(ART, card + '_check4x.png'))
    info[card] = {"export_offset_4x_px": [int(dx), int(dy)], "subpx_4x": [round(sub[0], 3), round(sub[1], 3)], 'render_origin_pt': o4.tolist(), 'match': round(float(score), 4),
                  'alpha_lost_outside_export': float(lost / 255.0), 'fit_err_255': round(float(fit_err), 2), 'no_filter_err_255': round(float(ident), 2),
                  'check_mean_255': round(float(d.mean()), 2), 'check_p99_5': round(float(np.percentile(d, 99.5)), 1),
                  'check_mean_interior': round(float(d[solid].mean()), 2), 'coef': coef.tolist()}
    print(card, {k: v for k, v in info[card].items() if k != 'coef'})

# sparkle (registry foreground, no filters): one 3x master per size, FIT
for k, sp in enumerate(N['registry']['sparkles']):
    raw = load(sp['raw'])
    W3, H3 = int(round(sp['w'] * S)), int(round(sp['h'] * S))
    node = dict(sp); node.pop('x'); node.pop('y'); node['rt'] = [[1, 0, 0], [0, 1, 0]]
    L = render(raw, node, S, (W3, H3))
    Image.fromarray(np.clip(L + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(ART, 'registry_sparkle%d.png' % (k + 1)))
    info['sparkle%d' % (k + 1)] = {'x': sp['x'] * S, 'y': sp['y'] * S, 'w': W3, 'h': H3, 'opacity': sp['opacity']}
json.dump(info, open(os.path.join(ART, 'prep.json'), 'w'), indent=1)


# ---- cloud (added 20 Nov): part of both lotties, behind the illustration, in front of the front end's radial glow.
# Figma draws it at 55% with blend OVERLAY over the glow. A lottie layer can only blend with what is inside the lottie
# (the glow is not), so the overlay result is baked into the cloud's colours against the glow + card fill behind it;
# drawn with normal blend at 55% layer opacity it lands on the Figma overlay look (at rest).
# The cloud node (140x103 pt) runs past the Visuals box (Figma clips it there); it is kept whole (420x309) so it can move,
# and the comp edge clips it like the box does.
def backdrop(card, ox=0.0, oy=0.0, wh=(BOX[0] * S, BOX[1] * S)):
    g = N[card]['glow']; fill = np.array(N['card_fill']) * 255
    yy, xx = np.mgrid[:wh[1], :wh[0]].astype(np.float32)
    cx, cy = (g['x'] + 110) * S - ox, (g['y'] + 110) * S - oy
    t = np.clip(np.hypot(xx + 0.5 - cx, yy + 0.5 - cy) / (g['r'] * S), 0, 1)[..., None]
    col = (np.array(g['c0']) * (1 - t) + np.array(g['c1']) * t) * 255
    al = (1 - t) * g['opacity']
    return fill * (1 - al) + col * al


def overlay(B, C):
    b, c = B / 255.0, C / 255.0
    return np.where(b <= 0.5, 2 * b * c, 1 - 2 * (1 - b) * (1 - c)) * 255


def over_s(dst, src):
    sa = src[..., 3:] / 255.0; da = dst[..., 3:] / 255.0; oa = sa + da * (1 - sa)
    rgb = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.dstack([rgb, oa * 255])


for card in ('collection', 'registry'):
    cn = dict(N[card]['cloud']); raw = load(cn['raw'])
    ox, oy = cn['x'] * S, cn['y'] * S
    wh = (int(round(cn['w'] * S)), int(round(cn['h'] * S)))
    L = render(raw, cn, S, wh, origin=(cn['x'], cn['y']))            # the whole cloud, its own frame
    B = backdrop(card, ox, oy, wh)
    baked = L.copy(); baked[..., :3] = overlay(B, L[..., :3])
    Image.fromarray(np.clip(L + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(ART, card + '_cloud_src.png'))
    Image.fromarray(np.clip(baked + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(ART, card + '_cloud.png'))
    # reference card look at rest (glow + card fill, overlay cloud at 55%, illustration, sparkles) in the 600x360 box
    Bb = backdrop(card)
    Lc = np.zeros((BOX[1] * S, BOX[0] * S, 4), np.float32)
    x0, y0 = int(round(ox)), int(round(oy))
    Lc[y0:, x0:] = L[:BOX[1] * S - y0, :BOX[0] * S - x0]
    a = Lc[..., 3:] / 255.0 * cn['opacity']
    R = Bb + a * (overlay(Bb, Lc[..., :3]) - Bb)
    F = np.asarray(Image.open(os.path.join(ART, card + '_full.png')).convert('RGBA')).astype(np.float32)
    if card == 'registry':
        for k in (1, 2):
            sp = info['sparkle%d' % k]; im = np.asarray(Image.open(os.path.join(ART, 'registry_sparkle%d.png' % k))).astype(np.float32)
            Fs = np.zeros_like(F); Fs[sp['y']:sp['y'] + sp['h'], sp['x']:sp['x'] + sp['w']] = im; Fs[..., 3] *= sp['opacity']
            F = over_s(F, Fs)
    fa = F[..., 3:] / 255.0
    R = R * (1 - fa) + F[..., :3] * fa
    Image.fromarray(np.clip(R + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(ART, card + '_card_reference.png'))
    Image.fromarray(np.clip(Bb + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(ART, card + '_backdrop.png'))
    info[card + '_cloud'] = {'x': x0, 'y': y0, 'w': wh[0], 'h': wh[1], 'opacity': cn['opacity'], 'pos_exact': [ox, oy]}
    print(card, 'cloud frame', info[card + '_cloud'])
json.dump(info, open(os.path.join(ART, 'prep.json'), 'w'), indent=1)
