#!/usr/bin/env python3
"""Dev spec (20 Nov, second round): all four card lotties carry their own opaque background, as vector shapes.
  - landscape Create-sheet pair -> 164x120 pt (492x360) window pinned to the card's right edge = Visuals box x 36..200
    (content shifted left 108 px); background = card fill #F9F9FB + the radial Glow.          comps '... · 164 bg'
  - portrait pair -> the whole 164x200 pt card (492x600); background = the card's linear gradient + the Glow; the visuals
    (clouds, picture, sparkles) sit in the bottom 120 pt exactly as before (+240 px).          comps '... · full card'
Motion, markers, HOLD rests, the 0.25 deg rule and every PNG piece are the existing ones (same files = TinyPNG cache hits).

Glow model (checked against Figma's 4x export of the landscape cards: straight-alpha interpolation, centre = node centre):
  colour(t) = c0 (1-t) + c1 t, alpha(t) = op (1-t), t = r / R.
After Effects can't take gradient colours from a script (Grad Colors is NO_VALUE), so in AE each background is a stack of
solid-filled rings / bands (<= 1 level per step), and the layer's comment carries the exact gradient that convert.py writes
into the lottie instead ('lottie-bg:' + JSON): one rect with a radial (or linear) gradient fill per glow / card gradient.
    python3 gen_build_164.py -> ../build/build_164.jsx"""
import json, math, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from PIL import Image
import gen_build as GB
import gen_build_portrait as GP

BUILD = os.path.join(ROOT, 'build')
N = json.load(open(os.path.join(HERE, 'figma_nodes.json')))
W = 492
LAND_X0 = 36.0          # the 164 window starts at Visuals x 36 (card right edge = Visuals x 200)
CARD_Y0 = 80.0          # portrait: Visuals box top inside the 164x200 card
TAG = 'gr-sheet-build'


def landscape_specs():
    # gen_build.cloud_layer re-saves the cloud crop into art/pieces/ (that file is the tinified one now): don't write
    save = Image.Image.save
    Image.Image.save = lambda *a, **k: None
    try:
        return [GB.collection(), GB.registry()]
    finally:
        Image.Image.save = save


# ---------------------------------------------------------------- background models (colours 0..255)
def glow_rgba(g, t):
    c0, c1 = np.array(g['c0']) * 255, np.array(g['c1']) * 255
    return c0 * (1 - t) + c1 * t, g['opacity'] * (1 - t)


def rings_opaque(base, g, cx, cy, R):
    """landscape (flat card fill): opaque discs whose edges sit where any channel of the exact composite crosses n + 0.5,
    each filled with the rounded composite: AE's 8-bit render then equals round(model) away from the ring edges."""
    rs = np.linspace(R, 0, 20001)
    def comp(r):
        col, a = glow_rgba(g, min(r / R, 1.0)); return base * (1 - a) + col * a
    q = np.array([np.round(comp(r)) for r in rs])
    cut = np.where(np.any(q[1:] != q[:-1], axis=1))[0]
    edges = [R] + [float(rs[i + 1]) for i in cut] + [0.0]
    out = []
    for e0, e1 in zip(edges[:-1], edges[1:]):
        if e0 - e1 < 1e-6: continue
        out.append({'kind': 'ellipse', 'c': [cx, cy], 's': [2 * e0, 2 * e0], 'color': list(np.round(comp((e0 + e1) / 2)) / 255.0), 'op': 100})
    return out[::-1]                       # top (smallest) first


def rings_alpha(colour_of, A_of, cx, cy, R, maxdiff, step=1.0):
    """portrait (graded card under it): single-colour translucent discs whose stacked alpha follows A(r)."""
    dA = step / max(maxdiff, 1e-3)
    out = []; prev = 0.0; start = R
    rs = np.linspace(R, 0, 4001)
    for r in rs[1:]:
        if A_of(r) - A_of(start) >= dA or r == 0:
            A = A_of((start + r) / 2.0)
            a = 1 - (1 - A) / (1 - prev)
            out.append({'kind': 'ellipse', 'c': [cx, cy], 's': [2 * start, 2 * start], 'color': list(colour_of / 255.0), 'op': round(100 * a, 4)})
            prev = A; start = r
    return out[::-1]


def bands_linear(c0, c1, y_t0, y_t1, H):
    """opaque horizontal bands of a vertical linear gradient c0 (at y_t0) -> c1 (at y_t1), comp px; edges where a channel
    crosses n + 0.5, each band the rounded colour (AE's 8-bit render = round(model))."""
    col = lambda y: c0 + (c1 - c0) * np.clip((y - y_t0) / (y_t1 - y_t0), 0, 1)
    ys = np.linspace(0, H, 24001)
    q = np.array([np.round(col(y)) for y in ys])
    cut = np.where(np.any(q[1:] != q[:-1], axis=1))[0]
    edges = [0.0] + [float(ys[i + 1]) for i in cut] + [float(H)]
    out = []
    for e0, e1 in zip(edges[:-1], edges[1:]):
        if e1 - e0 < 1e-6: continue
        out.append({'kind': 'rect', 'c': [W / 2.0, (e0 + e1) / 2.0], 's': [W + 2, e1 - e0 + (1.0 if e1 < H else 0.0)],
                    'color': list(np.round(col((e0 + e1) / 2)) / 255.0), 'op': 100})
    return out[::-1]


def stops_radial(g, n=17):
    ts = np.linspace(0, 1, n)
    return [[float(t)] + list(map(float, glow_rgba(g, t)[0] / 255.0)) + [float(glow_rgba(g, t)[1])] for t in ts]


def landscape_bg(card):
    g = N[card]['glow']; base = np.array(N['card_fill']) * 255
    cx, cy, R = (g['x'] + 110 - LAND_X0) * 3, (g['y'] + 110) * 3, 110 * 3       # comp px
    lot = {'items': [
        {'name': 'glow', 'rect': [0, 0, W, 360], 'grad': {'t': 2, 's': [cx, cy], 'e': [cx + R, cy], 'stops': stops_radial(g)}},
        {'name': 'card fill', 'rect': [0, 0, W, 360], 'solid': list(N['card_fill'])}]}
    groups = rings_opaque(base, g, cx, cy, R) + [{'kind': 'rect', 'c': [W / 2.0, 180], 's': [W + 2, 362], 'color': list(N['card_fill']), 'op': 100}]
    return [{'name': 'background: card fill + glow (vector; lottie = radial gradient)', 'comment': 'lottie-bg:' + json.dumps(lot), 'groups': groups}], len(groups)


P_BG = {'collection': {'grad': [[0.9882352948188782, 0.9882352948188782, 0.9921568632125854], [0.9370476007461548, 0.8860051035881042, 1.0]],
                       'glow': {'cx': 92.0, 'cy': 46.9638671875 + 141, 'c': [1.0, 0.8274509906768799, 0.8823529481887817], 'opacity': 1.0}},
        'registry': {'grad': [[0.9882352948188782, 0.9882352948188782, 0.9921568632125854], [0.7828274965286255, 0.8559803366661072, 1.0]],
                     'glow': {'cx': 92.0, 'cy': 12.0 + 141, 'c': [0.615686297416687, 0.7411764860153198, 0.9882352948188782], 'opacity': 0.5}}}


def portrait_bg(card):
    d = P_BG[card]; H = 600
    c0, c1 = np.array(d['grad'][0]) * 255, np.array(d['grad'][1]) * 255
    # card gradient: t = 0.9666 * y/200 + 0.0334 over the 200 pt card -> t=0 at y = -6.911 pt, t=1 at y = 200 pt
    y_t0, y_t1 = -0.0334 / 0.9666 * 200 * 3, 600.0
    g = d['glow']; cx, cy, R = g['cx'] * 3, (g['cy'] + CARD_Y0) * 3, 141 * 3
    col = np.array(g['c']) * 255; op = g['opacity']
    maxdiff = max(np.abs(col - c0).max(), np.abs(col - c1).max()) * op
    lot = {'items': [
        {'name': 'glow', 'rect': [0, 0, W, H], 'grad': {'t': 2, 's': [cx, cy], 'e': [cx + R, cy],
                                                        'stops': [[0.0] + list(g['c']) + [op], [1.0] + list(g['c']) + [0.0]]}},
        {'name': 'card gradient', 'rect': [0, 0, W, H], 'grad': {'t': 1, 's': [W / 2.0, y_t0], 'e': [W / 2.0, y_t1],
                                                                 'stops': [[0.0] + list(d['grad'][0]) + [1.0], [1.0] + list(d['grad'][1]) + [1.0]]}}]}
    groups = rings_alpha(col, lambda r: op * max(0.0, 1 - r / R), cx, cy, R, maxdiff) + bands_linear(c0, c1, y_t0, y_t1, H)
    return [{'name': 'background: card gradient + glow (vector; lottie = linear + radial gradient)', 'comment': 'lottie-bg:' + json.dumps(lot), 'groups': groups}], len(groups)


if __name__ == '__main__':
    comps = []
    for C in landscape_specs():
        C['comp'] = C['comp'] + ' · 164 bg'; C['w'], C['h'], C['ox'], C['oy'] = W, 360, -LAND_X0 * 3, 0
        C['piece_dir'] = os.path.join(ROOT, 'art', 'pieces'); C['bg'], n = landscape_bg(C['card']); C['_n'] = n
        comps.append(C)
    for C in (GP.collection(), GP.registry()):
        C['comp'] = C['comp'] + ' · full card'; C['w'], C['h'], C['ox'], C['oy'] = W, 600, 0, CARD_Y0 * 3
        C['piece_dir'] = GP.PIECES; C['bg'], n = portrait_bg(C['card']); C['_n'] = n
        comps.append(C)
    for c in comps:
        for L in c['layers']:
            if c['pieces'][L['piece']].get('kind') == 'copy' and 'scale' in L:
                assert min(min(kk[1]) for kk in L['scale']) >= 100 - 1e-6, (c['comp'], L['name'])
            for kk in L.get('rot', []):
                if abs(kk[1]) < 0.1: kk[1] = 0.15 if kk[1] >= 0 else -0.15
    spec = {'w': W, 'h': 360, 'fps': GB.FPS, 'root': '01 Hero lotties (export these)', 'folder': 'Bottom sheet', 'artfolder': 'art (portrait card pieces)',
            'piece_dir': GP.PIECES, 'comps': comps, 'log': os.path.join(BUILD, 'build_164.log')}
    tpl = open(os.path.join(HERE, 'builder_tpl.jsx')).read()
    open(os.path.join(BUILD, 'build_164.jsx'), 'w').write(tpl.replace('/*SPEC*/null', json.dumps(spec, ensure_ascii=True)))
    for c in comps:
        print('%-46s %dx%d off (%g,%g) intro %.3f s total %.3f s, %d layers, bg groups %d' % (c['comp'].encode('ascii', 'replace').decode(), c['w'], c['h'],
              c['ox'], c['oy'], c['t_in'], c['t_end'], len(c['layers']), c['_n']))
