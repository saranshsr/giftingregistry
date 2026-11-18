#!/usr/bin/env python3
"""Gift Registry hero lottie: art.json + pieces.json -> build/build.jsx (one ExtendScript that builds the 'gifting ' comp).

House style (nano): every element moves on its own, springs with overshoot (PACE 1.45), staggered, no exit, the last
frame is the Figma still. Timings live here; rerun this and the .jsx to rebuild identically."""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
ART = os.path.join(ROOT, 'art'); BUILD = os.path.join(ROOT, 'build'); os.makedirs(BUILD, exist_ok=True)
art = json.load(open(os.path.join(ART, 'art.json')))
pieces = json.load(open(os.path.join(HERE, 'pieces.json')))['title']
PACE = 1.45
FPS = 60.0
INF = 36            # bezier influence that makes a half-cycle read like a cosine


def snap(t): return round(t * FPS) / FPS


def spring_keys(t0, v0, v1, f, zeta, settle=0.004):
    """Keys at the extremes of a damped spring 0 -> 1 (zero velocity at each), mapped v0 -> v1.
    v0/v1 may be numbers or lists. Returns [[t, v, inInf, outInf], ...]."""
    w = 2 * math.pi * f * PACE; wd = w * math.sqrt(1 - zeta * zeta)
    lerp = lambda x: [a + (b - a) * x for a, b in zip(v0, v1)] if isinstance(v0, list) else v0 + (v1 - v0) * x
    out = [[snap(t0), lerp(0.0), INF, INF]]
    k = 1
    while True:
        tk = k * math.pi / wd; amp = math.exp(-zeta * w * tk)
        if amp < settle:
            out.append([snap(t0 + tk), lerp(1.0), INF, INF]); break
        out.append([snap(t0 + tk), lerp(1 - amp * (-1) ** k), INF, INF]); k += 1
    return out


def ease_keys(t0, t1, v0, v1, out_inf=33, in_inf=85):
    """A glide: leaves with a little ease, lands softly (no overshoot)."""
    return [[snap(t0), v0, 33, out_inf], [snap(t1), v1, in_inf, 33]]


def r2(v): return [round(x, 2) for x in v] if isinstance(v, list) else round(v, 3)


def clean(keys): return [[k[0], r2(k[1]), k[2], k[3]] for k in keys]


W, H = art['comp']
L = {}   # layer specs by name

# ---- timeline ----
T_GIFT, T_SWOOSH, T_GREEN, T_GREY, T_TITLE = 0.10, 0.36, 0.48, 0.64, 0.58
STAGGER = 0.017

# gift rig: pivot at the box's bottom middle
gb = art['gift_box']
piv = [gb['x'] + gb['w'] / 2, gb['y'] + gb['h']]
land_y = piv[1]
gift_scale = spring_keys(T_GIFT, [0, 0], [100, 100], 1.55, 0.45)
gift_rot = spring_keys(T_GIFT, -9.0, 0.0, 1.3, 0.5)
intro_y = spring_keys(T_GIFT, land_y + 42, land_y, 1.3, 0.62)
t_last = intro_y[-1][0]
idle = [[snap(max(1.30, t_last + 0.05)), land_y, 50, 50], [snap(2.15), land_y - 6, 50, 50], [snap(3.0), land_y, 50, 50]]
gift_pos_y = intro_y + idle
L['gift'] = {'pivot': piv, 'scale': clean(gift_scale), 'rot': clean(gift_rot), 'y': clean(gift_pos_y)}


def star(key, t0, t_tw, spin):
    s = art[key]; c = [s['x'] + s['w'] / 2, s['y'] + s['h'] / 2]
    sc = spring_keys(t0, [0, 0], [100, 100], 1.9, 0.38)
    rot = spring_keys(t0, spin, 0.0, 1.4, 0.55)
    tw = [[snap(t_tw), [100, 100], 40, 40], [snap(t_tw + 0.14), [124, 124], 40, 40], [snap(t_tw + 0.30), [92, 92], 40, 40],
          [snap(t_tw + 0.48), [100, 100], 40, 40]]
    rw = [[snap(t_tw), 0.0, 40, 40], [snap(t_tw + 0.2), 14.0 * (1 if spin < 0 else -1), 40, 40], [snap(t_tw + 0.55), 0.0, 40, 40]]
    assert sc[-1][0] < tw[0][0] and rot[-1][0] < rw[0][0], key
    return {'center': c, 'scale': clean(sc + tw), 'rot': clean(rot + rw)}


L['star_green'] = star('star_green', T_GREEN, 1.86, -100.0)
L['star_grey'] = star('star_grey', T_GREY, 2.32, 90.0)

L['swoosh'] = {'trim': clean(ease_keys(T_SWOOSH, T_SWOOSH + 0.72, 0.0, 100.0, out_inf=25, in_inf=80))}
L['waves'] = {'dx': clean(ease_keys(0.0, 1.9, -36.0, 0.0, out_inf=20, in_inf=90)),
              'op': clean(ease_keys(0.0, 0.8, 0.0, 100.0, out_inf=40, in_inf=60))}

# title pieces: outline (outer contours only) + letters (matte for the gradient picture), popping from the baseline
def poly_area(v):
    n = len(v); return 0.5 * sum(v[i][0] * v[(i + 1) % n][1] - v[(i + 1) % n][0] * v[i][1] for i in range(n))

all_paths = [p for pc in pieces for p in pc['paths']]
big = max(all_paths, key=lambda p: abs(poly_area(p['v'])))
outer_sign = 1 if poly_area(big['v']) > 0 else -1
base_y = art['baseline_y']
tp = []
for k, pc in enumerate(pieces):
    cxp = (pc['box'][0] + pc['box'][2]) / 2
    outers = [p for p in pc['paths'] if (1 if poly_area(p['v']) > 0 else -1) == outer_sign]
    tp.append({'pivot': [round(cxp, 2), base_y], 'paths': pc['paths'], 'outers': outers,
               'scale': clean(spring_keys(T_TITLE + k * STAGGER, [0, 0], [100, 100], 2.0, 0.55))})
L['title'] = tp
L['shadow_op'] = clean(ease_keys(T_TITLE + 0.25, T_TITLE + 0.85, 0.0, 100.0, out_inf=40, in_inf=60))

spec = {'comp': {'name': 'gifting ', 'w': W, 'h': H}, 'art_dir': ART, 'art': art, 'L': L, 'outline_px': 5 * 3 * 2,
        'log': os.path.join(BUILD, 'build.log')}
tpl = open(os.path.join(HERE, 'builder_tpl.jsx')).read()
open(os.path.join(BUILD, 'build.jsx'), 'w').write(tpl.replace('/*SPEC*/null', json.dumps(spec, ensure_ascii=True)))
last = max([k[0] for k in gift_pos_y] + [k[0] for s in ('star_green', 'star_grey') for k in L[s]['scale']] +
           [k[0] for p in tp for k in p['scale']])
print('pieces %d, outer sign %d, last key %.3f s, spec %.1f KB' % (len(tp), outer_sign, last, len(json.dumps(spec)) / 1024))
