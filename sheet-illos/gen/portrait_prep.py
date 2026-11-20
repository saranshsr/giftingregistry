#!/usr/bin/env python3
"""Portrait 'Empty state' cards (Figma 843:772844, cards 845:195232 / 845:195250, visuals box 164x120 pt) -> pieces at 3x
(492x360 px), transparent, for the portrait lotties. Same bitmaps as the landscape Create-sheet set (hashes 84b523.. and
6f1537.., same filters), placed bigger: collection = landscape picture x1.1557 (FILL 165x110), registry = x1.2405 (a wider
CROP window of the same image, same -1.98 deg turn). Both are a pure scale + shift of the landscape picture.

Pieces are LIFTED from the landscape cut (cut.py run in memory, unchanged): every pixel a landscape piece takes straight
from the picture is re-drawn from a native portrait render (sharp at 3x); only invented pixels (inpainted holes, ribbon /
lid extensions) are upscaled from the landscape piece. Ownership maps are warped linearly, so they still sum to one and
the pieces restack to the native portrait picture.
Dashes are lifted too (reusing the landscape dash PNGs scaled x1.16 / x1.24 was tried: visibly soft).

Clouds (overlay 55% over the glow in Figma) are baked against the card's own backdrop (linear card gradient + radial glow),
the collection's front cloud against backdrop + back cloud. Sparkles (collection only): one native render, used twice.

    python3 portrait_prep.py -> ../art/pieces_portrait/<card>/*.png + pieces.json, ../art/portrait_*.png, prints checks"""
import json, os, sys, types
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
FIG = os.path.join(ROOT, 'figma'); ART = os.path.join(ROOT, 'art')
OUTR = os.path.join(ART, 'pieces_portrait'); os.makedirs(OUTR, exist_ok=True)
N = json.load(open(os.path.join(HERE, 'figma_nodes.json')))
PREP = json.load(open(os.path.join(ART, 'prep.json')))
S = 3
BOX = (164, 120)
W3, H3 = BOX[0] * S, BOX[1] * S          # the comp (492x360)
# pieces are cut on a bigger WORK canvas so the art keeps what bleeds past the box (Figma clips it at the card edge,
# the comp edge clips it the same way); otherwise a float / overshoot would lift a hard cut edge into view
WO = (-10.0, 0.0)                         # work canvas origin in box pt
WW, WH = 186 * S, 168 * S                 # 558x504 px
OXC, OYC = WO[0] * S, WO[1] * S           # add to a work px to get a comp px

# ---- Figma facts (read 20 Nov from the card instances; coordinates in the 164x120 visuals box, pt)
P_NODES = {
    'collection': {'image': {'w': 165.0, 'h': 110.0, 'rt': [[1, 0, -1.0], [0, 1, 30.9638671875]], 'scaleMode': 'FILL',
                             'imageTransform': [[1, 0, 0], [0, 1, 0]], 'raw': 'collection/raw3.png'},
                   'clouds': [{'w': 179.4545440673828, 'h': 132.0272674560547, 'x': 2.2724609375, 'y': 60.0185546875},     # back (outer group)
                              {'w': 153.86141967773438, 'h': 113.19804382324219, 'x': 35.3466796875, 'y': 78.46875}],   # front (inner group, behind the picture)
                   'glow': {'cx': -49 + 141, 'cy': 46.9638671875 + 141, 'r': 141.0, 'c': [1.0, 0.8274509906768799, 0.8823529481887817], 'opacity': 1.0},
                   'grad': [[0.9882352948188782, 0.9882352948188782, 0.9921568632125854], [0.9370476007461548, 0.8860051035881042, 1.0]],
                   'sparkles': [{'w': 20.509090423583984, 'x': 9.4541015625, 'y': 21.5634765625, 'opacity': 0.8999999761581421},
                                {'w': 14.100000381469727, 'x': 129.9453125, 'y': 19.0, 'opacity': 0.699999988079071}]},
    'registry': {'image': {'w': 177.24002075195312, 'h': 118.1600112915039,
                           'rt': [[0.9994001388549805, -0.03463144600391388, -3.908203125], [0.03463144600391388, 0.9994001388549805, 30.0]],
                           'scaleMode': 'CROP', 'imageTransform': [[1.3000760078430176, 0, -0.1500379890203476], [0, 0.8667173981666565, 0.06664132326841354]],
                           'raw': 'registry/raw1.png'},
                 'clouds': [{'w': 179.4545440673828, 'h': 132.0272674560547, 'x': 20.2177734375, 'y': 45.0546875}],
                 'glow': {'cx': -49 + 141, 'cy': 12 + 141, 'r': 141.0, 'c': [0.615686297416687, 0.7411764860153198, 0.9882352948188782], 'opacity': 0.5},
                 'grad': [[0.9882352948188782, 0.9882352948188782, 0.9921568632125854], [0.7828274965286255, 0.8559803366661072, 1.0]],
                 'sparkles': []},
}
CLOUD_OP = 0.550000011920929
CARD_Y0 = 80.0          # visuals box top inside the 164x200 card
CARD_H = 200.0


def load(p): return np.asarray(Image.open(os.path.join(FIG, p)).convert('RGBA')).astype(np.float32)


# ---- same drawing model as prep_art.py (copied: prep_art.py runs on import)
def img_to_local(node, iw, ih):
    w, h = node['w'], node['h']
    if node['scaleMode'] in ('FILL', 'FIT'):
        s = (max if node['scaleMode'] == 'FILL' else min)(w / iw, h / ih)
        return np.array([[s, 0, (w - iw * s) / 2], [0, s, (h - ih * s) / 2], [0, 0, 1]])
    T = np.vstack([np.array(node['imageTransform']), [0, 0, 1]])
    return np.diag([w, h, 1]) @ np.linalg.inv(T) @ np.diag([1 / iw, 1 / ih, 1])


def local_to_box(node):
    if 'rt' in node: return np.vstack([np.array(node['rt']), [0, 0, 1]])
    return np.array([[1, 0, node['x']], [0, 1, node['y']], [0, 0, 1]])


def render(rgba, node, scale, out_wh, origin=(0, 0), K=4):
    ih, iw = rgba.shape[:2]
    M = np.diag([scale * K, scale * K, 1]) @ np.array([[1, 0, -origin[0]], [0, 1, -origin[1]], [0, 0, 1]]) @ local_to_box(node) @ img_to_local(node, iw, ih)
    pm = rgba.copy(); pm[..., :3] *= pm[..., 3:] / 255.0
    W, H = out_wh[0] * K, out_wh[1] * K
    dens = np.sqrt(abs(np.linalg.det(M[:2, :2])))
    if dens < 0.7:
        f = max(dens * 1.4, 1e-3); pm = cv2.resize(pm, (max(1, int(iw * f)), max(1, int(ih * f))), interpolation=cv2.INTER_AREA)
        M = M @ np.diag([iw / pm.shape[1], ih / pm.shape[0], 1])
    big = cv2.warpAffine(pm, M[:2], (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
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


def filt(rgba, coef):
    o = rgba.copy(); sh = o.shape
    o[..., :3] = np.clip((feats(o[..., :3]) @ np.array(coef)).reshape(sh[:-1] + (3,)) * 255, 0, 255)
    return o


def overlay(B, C):
    b, c = B / 255.0, C / 255.0
    return np.where(b <= 0.5, 2 * b * c, 1 - 2 * (1 - b) * (1 - c)) * 255


def over(dst, src):
    sa = src[..., 3:] / 255.0; da = dst[..., 3:] / 255.0; oa = sa + da * (1 - sa)
    rgb = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.dstack([rgb, oa * 255])


def backdrop(card, scale, wh=None, ox=0.0, oy=0.0):
    """card gradient (white card under a top->bottom linear gradient) + radial glow, opaque RGB, px = box_pt*scale - (ox, oy)."""
    wh = wh or (BOX[0] * scale, BOX[1] * scale)
    nd = P_NODES[card]
    yy, xx = np.mgrid[:wh[1], :wh[0]].astype(np.float32)
    bx, by = (xx + 0.5 + ox) / scale, (yy + 0.5 + oy) / scale            # box pt
    t = np.clip(0.9666000008583069 * (by + CARD_Y0) / CARD_H + 0.033399999141693115, 0, 1)[..., None]
    g0, g1 = np.array(nd['grad'][0]) * 255, np.array(nd['grad'][1]) * 255
    base = g0 * (1 - t) + g1 * t
    g = nd['glow']
    tr = np.clip(np.hypot(bx - g['cx'], by - g['cy']) / g['r'], 0, 1)[..., None]
    al = (1 - tr) * g['opacity']
    return base * (1 - al) + np.array(g['c']) * 255 * al


def blend_overlay(B, L, op):
    a = L[..., 3:] / 255.0 * op
    return B + a * (overlay(B, L[..., :3]) - B)


def M_raw_to_box(node, iw, ih): return local_to_box(node) @ img_to_local(node, iw, ih)


# ---- the landscape cut, in memory (exact float pieces, before PNG / TinyPNG quantisation)
def landscape_cut(card):
    import cut
    cut.Card.write = lambda self, sparkles=(): self
    K = getattr(cut, card)()
    layers = []
    for nm, P, meta in K.layers:
        if nm == 'base': P = K.base
        layers.append((nm, P, meta))
    return K.C, layers


def lift(card):
    nd = P_NODES[card]; nl = N[card]['image']
    raw = load(nl['raw']); ih, iw = raw.shape[:2]
    Ml = M_raw_to_box(nl, iw, ih); Mp = M_raw_to_box(nd['image'], iw, ih)
    Spt = Mp @ np.linalg.inv(Ml)                                   # landscape box pt -> portrait box pt
    lin = Spt[:2, :2]; k = float(np.sqrt(abs(np.linalg.det(lin))))
    assert np.allclose(lin, np.eye(2) * k, atol=1e-6), lin        # pure scale + shift
    Spx = np.diag([S, S, 1.0]) @ np.array([[1, 0, -WO[0]], [0, 1, -WO[1]], [0, 0, 1]]) @ Spt @ np.diag([1.0 / S, 1.0 / S, 1])   # landscape px -> work px
    Mcv = (np.array([[1, 0, -0.5], [0, 1, -0.5], [0, 0, 1]]) @ Spx @ np.array([[1, 0, 0.5], [0, 1, 0.5], [0, 0, 1]]))[:2]

    def wp(img, interp=cv2.INTER_LINEAR):
        return cv2.warpAffine(img.astype(np.float32), Mcv, (WW, WH), flags=interp, borderMode=cv2.BORDER_CONSTANT, borderValue=0)

    def pt(p): q = Spx @ np.array([p[0], p[1], 1.0]); return [round(float(q[0] + OXC), 3), round(float(q[1] + OYC), 3)]   # comp px

    rawf = filt(raw, PREP[card]['coef'])
    F = render(rawf, nd['image'], S, (WW, WH), origin=WO)            # native portrait picture, 3x, work canvas
    Fpm = F[..., :3] * F[..., 3:] / 255.0
    C, layers = landscape_cut(card)
    a = C[..., 3]
    # who reproduces the picture where (exact equality: the cut copies picture pixels untouched)
    names = [nm for nm, _, _ in layers if not nm.startswith('sparkle')]
    eq = {}
    for nm, P, meta in layers:
        if nm.startswith('sparkle'): continue
        eq[nm] = (a > 0) & (np.abs(P[..., :3] - C[..., :3]).max(2) < 1e-3) & (np.abs(P[..., 3] - a) < 1e-3)
    top = np.full(a.shape, -1, np.int32)
    for i, nm in enumerate(names): top[eq[nm]] = i                 # topmost wins
    unowned = (a > 0) & (top < 0)
    # transparent picture pixels belong to the nearest owner, so a warped rim keeps its full alpha
    idx = ndimage.distance_transform_edt(top < 0, return_distances=False, return_indices=True)
    lab = top[idx[0], idx[1]]
    out = {}
    for i, nm in enumerate(names):
        P = [L for L in layers if L[0] == nm][0][1]
        Wl = ((lab == i) | eq[nm]).astype(np.float32)               # 'dual' owners (base under a copy) keep their pixels too
        # ownership stays HARD (nearest): soft cut lines would dim where two opaque pieces meet (a*w over a*(1-w) < a)
        Wp = wp(Wl, cv2.INTER_NEAREST) > 0.5
        # everything else: only the piece's invented pixels, upscaled with normalised weights (taken from non-owned pixels
        # only): no spill of picture pixels under a neighbour's soft rim, no half-alpha seam where an invented fill meets
        # the piece's own picture pixels
        ext = 1.0 - Wl
        Pe = wp(np.dstack([P[..., :3] * P[..., 3:] / 255.0, P[..., 3:]]) * ext[..., None])
        we = wp(ext)
        Pe = Pe / np.maximum(we, 1e-6)[..., None] * (we > 1e-4)[..., None]
        Pw = np.dstack([np.where(Pe[..., 3:] > 0, Pe[..., :3] / np.maximum(Pe[..., 3:], 1e-6) * 255.0, 0), Pe[..., 3:]])
        out[nm] = np.clip(np.where(Wp[..., None], F, Pw), 0, 255)
    info = {'k': k, 'S_pt': Spt[:2].tolist(), 'unowned_px': int(unowned.sum())}
    return F, out, layers, pt, info


def write_pieces(card, F, out, layers, pt, k):
    od = os.path.join(OUTR, card); os.makedirs(od, exist_ok=True)
    land = json.load(open(os.path.join(ART, 'pieces', card, 'pieces.json')))
    lmeta = {L['name']: L for L in land['layers']}
    res = {'canvas': [W3, H3], 'note': 'x/y/pivots in comp px (492x360); pieces may run past the comp', 'k': k, 'layers': []}
    st = np.zeros((WH, WW, 4), np.float32)
    for nm, P, meta in layers:
        if nm.startswith('sparkle'): continue
        lm = lmeta[nm]
        ent = {'name': nm}
        for key in ('pivot', 'anchor'):
            if key in lm: ent[key] = pt(lm[key])
        if 'kind' in lm: ent['kind'] = lm['kind']
        if True:
            Q = out[nm]
            L8 = np.clip(Q + 0.5, 0, 255).astype(np.uint8); L8[..., :3] = np.where(L8[..., 3:] == 0, 0, L8[..., :3])
            bb = Image.fromarray(L8).getbbox()
            fn = '%s_portrait_%s.png' % (card, nm)
            Image.fromarray(L8).crop(bb).save(os.path.join(od, fn))
            ent.update({'file': fn, 'x': bb[0] + OXC, 'y': bb[1] + OYC, 'w': bb[2] - bb[0], 'h': bb[3] - bb[1]})
            st = over(st, L8.astype(np.float32))
        res['layers'].append(ent)
    pa, pb = st[..., :3] * st[..., 3:] / 255, F[..., :3] * F[..., 3:] / 255
    e = np.abs(np.concatenate([pa - pb, st[..., 3:] - F[..., 3:]], 2)).max(2)
    res['restack'] = {'mean': round(float(e.mean()), 3), 'p99_9': round(float(np.percentile(e, 99.9)), 2), 'max': round(float(e.max()), 2)}
    Image.fromarray(np.clip(st + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(OUTR, card + '_restack.png'))
    return res


def cloud_px(card, cn, scale, raw):
    """whole cloud on a canvas-aligned grid (origin snapped down to a px), FIT."""
    node = {'w': cn['w'], 'h': cn['h'], 'x': cn['x'], 'y': cn['y'], 'scaleMode': 'FIT'}
    ox, oy = np.floor(cn['x'] * scale), np.floor(cn['y'] * scale)
    wh = (int(np.ceil((cn['x'] + cn['w']) * scale) - ox), int(np.ceil((cn['y'] + cn['h']) * scale) - oy))
    L = render(raw, node, scale, wh, origin=(ox / scale, oy / scale))
    return L, int(ox), int(oy)


def sparkle_px(sp, scale, raw):
    node = {'w': sp['w'], 'h': sp['w'], 'x': sp['x'], 'y': sp['y'], 'scaleMode': 'FIT'}
    ox, oy = np.floor(sp['x'] * scale), np.floor(sp['y'] * scale)
    wh = (int(np.ceil((sp['x'] + sp['w']) * scale) - ox), int(np.ceil((sp['y'] + sp['w']) * scale) - oy))
    return render(raw, node, scale, wh, origin=(ox / scale, oy / scale)), int(ox), int(oy)


def paste(canvas_wh, L, x, y):
    Z = np.zeros((canvas_wh[1], canvas_wh[0], 4), np.float32)
    h, w = L.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(canvas_wh[0], x + w), min(canvas_wh[1], y + h)
    if x1 > x0 and y1 > y0: Z[y0:y1, x0:x1] = L[y0 - y:y1 - y, x0 - x:x1 - x]
    return Z


def card_look(card, scale, F, raw_cloud, raw_spk):
    """the Figma card look at rest in the visuals box: backdrop, overlay clouds, picture, sparkles (opaque RGB)."""
    wh = (BOX[0] * scale, BOX[1] * scale)
    R = backdrop(card, scale)
    for cn in P_NODES[card]['clouds']:
        L, x, y = cloud_px(card, cn, scale, raw_cloud)
        R = blend_overlay(R, paste(wh, L, x, y), CLOUD_OP)
    fa = F[..., 3:] / 255.0; R = R * (1 - fa) + F[..., :3] * fa
    for sp in P_NODES[card]['sparkles']:
        L, x, y = sparkle_px(sp, scale, raw_spk); Z = paste(wh, L, x, y); za = Z[..., 3:] / 255.0 * sp['opacity']
        R = R * (1 - za) + Z[..., :3] * za
    return R


if __name__ == '__main__':
    raw_cloud = load('cloud/raw3.png'); raw_spk = load('registry/sparkle_raw.png')
    allinfo = {}
    for card in ('collection', 'registry'):
        F, out, layers, pt, info = lift(card)
        res = write_pieces(card, F, out, layers, pt, info['k'])
        Fbox = F[-int(OYC):-int(OYC) + H3, -int(OXC):-int(OXC) + W3]
        Image.fromarray(np.clip(F + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(ART, 'portrait_%s_full.png' % card))
        # clouds: baked overlay, kept whole; each against everything that is behind it at rest
        wh = (W3, H3); B = backdrop(card, S); clouds = []
        for ci, cn in enumerate(P_NODES[card]['clouds']):
            L, x, y = cloud_px(card, cn, S, raw_cloud)
            # backdrop under the cloud frame (cloud may run past the box: extend the backdrop there)
            Bf = backdrop(card, S, wh=(L.shape[1], L.shape[0]), ox=x, oy=y)
            for prev in clouds:   # the earlier cloud(s) already overlaid on the backdrop
                Lp, xp, yp = prev
                Zp = np.zeros_like(L); h, w = Lp.shape[:2]
                xs0, ys0 = max(0, xp - x), max(0, yp - y); xs1, ys1 = min(L.shape[1], xp - x + w), min(L.shape[0], yp - y + h)
                Zp[ys0:ys1, xs0:xs1] = Lp[ys0 - (yp - y):ys1 - (yp - y), xs0 - (xp - x):xs1 - (xp - x)]
                Bf = blend_overlay(Bf, Zp, CLOUD_OP)
            baked = L.copy(); baked[..., :3] = overlay(Bf, L[..., :3])
            L8 = np.clip(baked + 0.5, 0, 255).astype(np.uint8); L8[..., :3] = np.where(L8[..., 3:] == 0, 0, L8[..., :3])
            bb = Image.fromarray(L8).getbbox()
            nm = 'cloud' if len(P_NODES[card]['clouds']) == 1 else ('cloud_back', 'cloud_front')[ci]
            fn = '%s_portrait_%s.png' % (card, nm)
            Image.fromarray(L8).crop(bb).save(os.path.join(OUTR, card, fn))
            res.setdefault('clouds', []).append({'name': nm, 'file': fn, 'x': x + bb[0], 'y': y + bb[1], 'w': bb[2] - bb[0], 'h': bb[3] - bb[1], 'opacity': CLOUD_OP})
            clouds.append((L, x, y))
        # sparkles: one native render (the bigger one), the small one reuses it scaled
        sps = P_NODES[card]['sparkles']
        if sps:
            L, x, y = sparkle_px(sps[0], S, raw_spk)
            L8 = np.clip(L + 0.5, 0, 255).astype(np.uint8); L8[..., :3] = np.where(L8[..., 3:] == 0, 0, L8[..., :3])
            bb = Image.fromarray(L8).getbbox(); fn = '%s_portrait_sparkle.png' % card
            Image.fromarray(L8).crop(bb).save(os.path.join(OUTR, card, fn))
            sp_list = []
            for si, sp in enumerate(sps):
                f = sp['w'] / sps[0]['w']
                # the glyph's place inside its FIT frame scales with the frame
                gx = (x + bb[0]) / S - sps[0]['x']; gy = (y + bb[1]) / S - sps[0]['y']
                sx, sy = (sp['x'] + gx * f) * S, (sp['y'] + gy * f) * S
                sp_list.append({'name': 'sparkle%d' % (si + 1), 'file': fn, 'x': round(sx, 3), 'y': round(sy, 3),
                                'w': round((bb[2] - bb[0]) * f, 3), 'h': round((bb[3] - bb[1]) * f, 3), 'sc': f, 'opacity': sp['opacity']})
            res['sparkles'] = sp_list
        res['backdrop_note'] = 'card gradient + glow are drawn by the front end; clouds baked against them'
        json.dump(res, open(os.path.join(OUTR, card, 'pieces.json'), 'w'), indent=1)
        # card look at 3x (reference for the filmstrip) and a 4x check against Figma's own export of the visuals
        R3 = card_look(card, S, Fbox, raw_cloud, raw_spk)
        Image.fromarray(np.clip(R3 + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(ART, 'portrait_%s_card_reference.png' % card))
        Image.fromarray(np.clip(B + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(ART, 'portrait_%s_backdrop.png' % card))
        F4 = render(filt(load(N[card]['image']['raw']), PREP[card]['coef']), P_NODES[card]['image'], 4, (BOX[0] * 4, BOX[1] * 4))
        R4 = card_look(card, 4, F4, raw_cloud, raw_spk)
        # Figma's own 4x export of the whole card (845:195232 / 845:195250), visuals box = rows 320..800
        E = np.asarray(Image.open(os.path.join(FIG, 'portrait_' + card, 'card4x.png')).convert('RGB')).astype(np.float32)[320:800]
        d = np.abs(R4 - E).mean(2)
        inner = np.zeros(d.shape, bool); inner[8:-40, 8:-8] = True             # skip the card's rounded bottom corners / edges
        inner[:176, 236:420] = False                                             # and the + button (dev-built, not in the lottie)
        Image.fromarray(np.clip(np.hstack([E, R4, np.dstack([np.clip(d * 8, 0, 255)] * 3)]), 0, 255).astype(np.uint8)).save(
            os.path.join(ART, 'portrait_%s_check4x.png' % card))
        allinfo[card] = dict(info, restack=res['restack'], check4x_mean=round(float(d[inner].mean()), 2),
                             check4x_p99=round(float(np.percentile(d[inner], 99)), 1))
        print(card, allinfo[card])
    json.dump(allinfo, open(os.path.join(ART, 'portrait_prep.json'), 'w'), indent=1)
