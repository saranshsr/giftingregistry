#!/usr/bin/env python3
"""Gift Registry 'Create' bottom sheet illustrations: pieces.json -> ../build/build_sheet.jsx (one ExtendScript that
builds 'GR sheet · Collection' and 'GR sheet · Gift registry' in 01 Hero lotties (export these)/Bottom sheet/).

House style (same springs as the v2 hero, PACE 1.45, 60 fps): an entrance (marker 'intro'), then a seamless idle loop
(marker 'idle') whose last frame equals its first. Rest pose = the Figma picture (pieces restack to it).
Rules kept: equal-value neighbours become HOLD keys (builder), rotating image layers never land on exactly 0 deg
(fixed +0.25 deg), 'copy' pieces never scale below 100% (they cover their own footprint)."""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
PIECES = os.path.join(ROOT, 'art', 'pieces'); BUILD = os.path.join(ROOT, 'build'); os.makedirs(BUILD, exist_ok=True)
PACE = 1.45
FPS = 60.0
INF = 36
R0 = 0.25            # ThorVG: a rotated image layer never rests on exactly 0 deg
IDLE = 3.5           # seconds, the loop
# 20 Nov: the cloud blooms first; the object's whole entrance starts OBJ0 later and runs TS as long (springs FS faster),
# so the sheet (which starts the lottie as it rises) feels landed by ~1.1 s
OBJ0, TS, FS = 0.10, 0.78, 1.25


def T_(t): return OBJ0 + TS * t


def snap(t): return round(t * FPS) / FPS


def lerp(v0, v1, x): return [a + (b - a) * x for a, b in zip(v0, v1)] if isinstance(v0, list) else v0 + (v1 - v0) * x


def spring(t0, v0, v1, f, zeta, settle=0.02):
    """keys at the extremes of a damped spring v0 -> v1 (zero velocity at each)."""
    w = 2 * math.pi * f * FS * PACE; wd = w * math.sqrt(1 - zeta * zeta)
    out = [[snap(t0), lerp(v0, v1, 0.0), INF, INF]]; k = 1
    while True:
        tk = k * math.pi / wd; amp = math.exp(-zeta * w * tk)
        if amp < settle: out.append([snap(t0 + tk), lerp(v0, v1, 1.0), INF, INF]); break
        out.append([snap(t0 + tk), lerp(v0, v1, 1 - amp * (-1) ** k), INF, INF]); k += 1
    return out


def bump(t0, rest, peaks, dur, inf=50):
    """rest -> peaks... -> rest, evenly spaced over dur, eased (cosine-like) - used for punches that must stay >= rest."""
    n = len(peaks) + 1
    ks = [[snap(t0), rest, inf, inf]]
    for i, p in enumerate(peaks): ks.append([snap(t0 + dur * (i + 1) / n), p, inf, inf])
    ks.append([snap(t0 + dur), rest, inf, inf])
    return ks


def ease(t0, t1, v0, v1, o=33, i=85): return [[snap(t0), v0, 33, o], [snap(t1), v1, i, 33]]


def r2(v): return [round(x, 3) for x in v] if isinstance(v, list) else round(v, 3)


def clean(keys):
    out = []
    for k in keys:
        if out and abs(out[-1][0] - k[0]) < 1e-9: out[-1] = [k[0], r2(k[1]), k[2], k[3]]; continue
        out.append([k[0], r2(k[1]), k[2], k[3]])
    return out


def last_t(*tracks): return max(k[0] for tr in tracks for k in tr)


def cloud_layer(card, P):
    """the cloud (20 Nov): baked-overlay picture (prep_art.py), normal blend at 55%, behind everything, not on the rig.
    Blooms in first (80% -> 100%, +8 pt -> 0, fades up); idle = one slow breathe + drift, seamless."""
    from PIL import Image
    info = json.load(open(os.path.join(ROOT, 'art', 'prep.json')))[card + '_cloud']
    im = Image.open(os.path.join(ROOT, 'art', card + '_cloud.png')); bb = im.getbbox()
    fn = '%s_cloud.png' % card; im.crop(bb).save(os.path.join(PIECES, card, fn))
    pc = {'name': 'cloud', 'file': fn, 'x': info['x'] + bb[0], 'y': info['y'] + bb[1], 'w': bb[2] - bb[0], 'h': bb[3] - bb[1]}
    P['cloud'] = pc
    c = [pc['x'] + pc['w'] / 2.0, pc['y'] + pc['h'] / 2.0]
    L = {'name': 'cloud', 'piece': 'cloud', 'pivot': c, 'noparent': True, 'op_keys': ease(0.0, 0.32, 0.0, 100.0 * info['opacity'], o=25, i=80),
         'scale': spring(0.0, [80, 80], [100, 100], 1.05, 0.8), 'pos': spring(0.0, [c[0], c[1] + 24.0], c, 1.0, 0.85)}
    return L


def cloud_idle(L, I, t_end):
    c = L['pivot']; D = t_end - I
    L['scale'] = clean(L['scale'] + [[I, [100, 100], 50, 50], [snap(I + D * 0.5), [102, 102], 50, 50], [t_end, [100, 100], 50, 50]])
    L['pos'] = clean(L['pos'] + [[I, c, 50, 50], [snap(I + D * 0.5), [c[0] + 4.0, c[1] - 3.0], 50, 50], [t_end, c, 50, 50]])
    L['op_keys'] = clean(L['op_keys'])


def load(card):
    d = json.load(open(os.path.join(PIECES, card, 'pieces.json')))
    return d, {L['name']: L for L in d['layers']}


# ------------------------------------------------------------------ collection
def collection():
    d, P = load('collection')
    CL = cloud_layer('collection', P)
    base = P['base']
    rig_piv = [base['x'] + base['w'] / 2.0, base['y'] + base['h']]          # basket's bottom middle
    T = {}
    # entrance: the basket springs up from its base
    T['rig_s'] = spring(T_(0.0), [0, 0], [100, 100], 1.5, 0.62)     # ~8% overshoot: stays inside the 600x360 box; nothing shows before the cloud leads
    T['rig_y'] = spring(T_(0.0), rig_piv[1] + 30, rig_piv[1], 1.45, 0.62)
    # ribbons unfurl from tucked-in, a beat behind the basket
    T['rl_r'] = spring(T_(0.06), R0 - 14.0, R0, 1.35, 0.45)
    T['rr_r'] = spring(T_(0.10), R0 + 12.0, R0, 1.35, 0.45)
    # lamp bobs up (stretch from the stem foot, never below 100%)
    T['lamp_s'] = bump(T_(0.26), [100, 100], [[103, 112], [100, 100.6], [101, 103]], 0.62 * TS)
    # heart badge pops (scale up from its face centre with a small twist) - punch only, stays >= 100%
    T['heart_s'] = bump(T_(0.36), [100, 100], [[124, 124], [100, 100], [105, 105]], 0.56 * TS)
    T['heart_r'] = bump(T_(0.36), R0, [R0 - 8.0, R0, R0 + 1.5], 0.56 * TS)       # twist only while scaled up
    # star: pops in spinning
    T['star_s'] = spring(T_(0.40), [0, 0], [100, 100], 1.9, 0.42)
    T['star_r'] = spring(T_(0.40), R0 - 90.0, R0, 1.5, 0.58)
    # dashes: burst out from the star, nearest first
    sc = [P['star']['anchor'][0], P['star']['anchor'][1] + 40]
    dash = []
    for k in range(3):
        L = P['dash%d' % (k + 1)]; c = [L['x'] + L['w'] / 2.0, L['y'] + L['h'] / 2.0]
        st = [sc[0] + (c[0] - sc[0]) * 0.55, sc[1] + (c[1] - sc[1]) * 0.55]
        t0 = T_(0.48 + 0.04 * k)
        dash.append({'c': c, 's': spring(t0, [0, 0], [100, 100], 1.8, 0.45), 'p': spring(t0, st, c, 1.5, 0.6)})
    t_in = snap(last_t(CL['scale'], CL['pos'], CL['op_keys'], T['rig_s'], T['rig_y'], T['rl_r'], T['rr_r'], T['lamp_s'], T['heart_s'], T['heart_r'],
                       T['star_s'], T['star_r'], *[x['s'] for x in dash], *[x['p'] for x in dash]) + 0.05)
    t_end = snap(t_in + IDLE); I = t_in; D = t_end - t_in
    # ---- idle (every track starts and ends at rest, eased in/out: the loop seam has zero velocity on both sides)
    T['rig_y'] += [[I, rig_piv[1], 50, 50], [snap(I + D * 0.5), rig_piv[1] - 4.0, 50, 50], [t_end, rig_piv[1], 50, 50]]
    T['rl_r'] += [[I, R0, 50, 50], [snap(I + D * 0.30), R0 + 1.6, 50, 50], [snap(I + D * 0.75), R0 - 1.1, 50, 50], [t_end, R0, 50, 50]]
    T['rr_r'] += [[I, R0, 50, 50], [snap(I + D * 0.38), R0 - 1.5, 50, 50], [snap(I + D * 0.80), R0 + 1.0, 50, 50], [t_end, R0, 50, 50]]
    T['lamp_s'] += bump(I + 0.9, [100, 100], [[100, 103]], 0.9)
    T['heart_s'] += bump(I + 2.0, [100, 100], [[106, 106]], 0.7)
    T['heart_r'] += bump(I + 2.0, R0, [R0 - 3.0], 0.7)
    tw = I + 0.55
    T['star_s'] += [[snap(tw), [100, 100], 40, 40], [snap(tw + 0.16), [120, 120], 40, 40], [snap(tw + 0.34), [92, 92], 40, 40], [snap(tw + 0.52), [100, 100], 40, 40]]
    T['star_r'] += [[snap(tw), R0, 40, 40], [snap(tw + 0.22), R0 + 14.0, 40, 40], [snap(tw + 0.6), R0, 40, 40]]
    for k, x in enumerate(dash):
        t0 = I + 0.62 + 0.07 * k
        x['s'] += bump(t0, [100, 100], [[112, 112]], 0.42, inf=45)
    for kk in list(T): T[kk] = clean(T[kk])
    for x in dash: x['s'] = clean(x['s']); x['p'] = clean(x['p'])
    cloud_idle(CL, I, t_end)
    layers = [CL,
        {'name': 'ribbon left', 'piece': 'ribbon_left', 'pivot': P['ribbon_left']['pivot'], 'rot': T['rl_r']},
        {'name': 'ribbon right', 'piece': 'ribbon_right', 'pivot': P['ribbon_right']['pivot'], 'rot': T['rr_r']},
        {'name': 'basket', 'piece': 'base'},
        {'name': 'lamp', 'piece': 'lamp', 'pivot': P['lamp']['anchor'], 'scale': T['lamp_s']},
        {'name': 'heart badge', 'piece': 'heart', 'pivot': P['heart']['anchor'], 'scale': T['heart_s'], 'rot': T['heart_r']},
        {'name': 'star', 'piece': 'star', 'pivot': P['star']['anchor'], 'scale': T['star_s'], 'rot': T['star_r']},
    ] + [{'name': 'dash %d' % (k + 1), 'piece': 'dash%d' % (k + 1), 'pivot': x['c'], 'scale': x['s'], 'pos': x['p']} for k, x in enumerate(dash)]
    return {'comp': 'GR sheet · Collection', 'card': 'collection', 'pieces': P, 'rig': {'pivot': rig_piv, 'scale': T['rig_s'], 'y': T['rig_y']},
            'layers': layers, 't_in': t_in, 't_end': t_end}


# ------------------------------------------------------------------ registry
def registry():
    d, P = load('registry')
    CL = cloud_layer('registry', P)
    base = P['base']
    rig_piv = [base['x'] + base['w'] / 2.0, base['y'] + base['h']]
    T = {}
    T['rig_s'] = spring(T_(0.0), [0, 0], [100, 100], 1.5, 0.62)     # ~8% overshoot: stays inside the 600x360 box; nothing shows before the cloud leads
    T['rig_y'] = spring(T_(0.0), rig_piv[1] + 30, rig_piv[1], 1.45, 0.62)
    # lid: lifts (tips up about its left contact with the card) and settles on a spring
    lid_t = T_(0.22); LT = 0.16 * TS
    T['lid_r'] = [[0.0, R0, INF, INF]] + ease(lid_t, lid_t + LT, R0, R0 - 9.0, o=20, i=70)[:] + spring(lid_t + LT, R0 - 9.0, R0, 1.45, 0.45)[1:]
    T['lid_y'] = [[0.0, 0.0, INF, INF]] + ease(lid_t, lid_t + LT, 0.0, -7.0, o=20, i=70) + spring(lid_t + LT, -7.0, 0.0, 1.6, 0.55)[1:]
    # heart floats out of the box (up-left), the arrow badge a beat later (up-right)
    def float_out(name, t0, off, spin, s0=25):
        L = P[name]; a = L['anchor']
        return {'s': spring(t0, [s0, s0], [100, 100], 1.55, 0.45),
                'p': spring(t0, [a[0] + off[0], a[1] + off[1]], a, 1.5, 0.6),
                'r': spring(t0, R0 + spin, R0, 1.5, 0.55)}
    H = float_out('heart', T_(0.34), [14, 12], -14.0, s0=62)    # from its tip; small reveal behind it
    B = float_out('badge', T_(0.42), [-30, 20], 22.0, s0=0)
    sc = [495.0, 160.0]           # dashes radiate from the badge's upper left
    dash = []
    for k in range(3):
        L = P['dash%d' % (k + 1)]; c = [L['x'] + L['w'] / 2.0, L['y'] + L['h'] / 2.0]
        st = [sc[0] + (c[0] - sc[0]) * 0.55, sc[1] + (c[1] - sc[1]) * 0.55]
        t0 = T_(0.50 + 0.04 * k)
        dash.append({'c': c, 's': spring(t0, [0, 0], [100, 100], 1.8, 0.45), 'p': spring(t0, st, c, 1.5, 0.6)})
    spk = []
    for k, t0 in enumerate((T_(0.44), T_(0.50))):
        L = P['sparkle%d' % (k + 1)]; c = [L['x'] + L['w'] / 2.0, L['y'] + L['h'] / 2.0]
        spk.append({'c': c, 's': spring(t0, [0, 0], [100, 100], 1.9, 0.38), 'r': spring(t0, R0 - 70.0 * (1 if k == 0 else -1), R0, 1.4, 0.55),
                    'op': L['opacity']})
    t_in = snap(last_t(CL['scale'], CL['pos'], CL['op_keys'], T['rig_s'], T['rig_y'], T['lid_r'], T['lid_y'], H['s'], H['p'], H['r'], B['s'], B['p'], B['r'],
                       *[x['s'] for x in dash], *[x['p'] for x in dash], *[x['s'] for x in spk], *[x['r'] for x in spk]) + 0.05)
    t_end = snap(t_in + IDLE); I = t_in; D = t_end - t_in
    # ---- idle
    T['rig_y'] += [[I, rig_piv[1], 50, 50], [snap(I + D * 0.5), rig_piv[1] - 4.0, 50, 50], [t_end, rig_piv[1], 50, 50]]
    T['lid_r'] += bump(I + 1.55, R0, [R0 - 2.2, R0 + 0.4], 0.75)
    ha, ba = P['heart']['anchor'], P['badge']['anchor']
    H['p'] += [[I, ha, 50, 50], [snap(I + D * 0.45), [ha[0], ha[1] - 6.0], 50, 50], [t_end, ha, 50, 50]]
    H['r'] += [[I, R0, 50, 50], [snap(I + D * 0.30), R0 - 4.0, 50, 50], [snap(I + D * 0.72), R0 + 2.5, 50, 50], [t_end, R0, 50, 50]]
    B['p'] += [[I, ba, 50, 50], [snap(I + D * 0.62), [ba[0], ba[1] - 5.0], 50, 50], [t_end, ba, 50, 50]]
    B['r'] += [[I, R0, 50, 50], [snap(I + D * 0.55), R0 + 5.0, 50, 50], [t_end, R0, 50, 50]]
    for k, x in enumerate(dash):
        x['s'] += bump(I + 1.05 + 0.07 * k, [100, 100], [[112, 112]], 0.42, inf=45)
    for k, x in enumerate(spk):
        tw = I + (0.45 if k == 0 else 2.05)
        x['s'] += [[snap(tw), [100, 100], 40, 40], [snap(tw + 0.15), [128, 128], 40, 40], [snap(tw + 0.32), [70, 70], 40, 40], [snap(tw + 0.55), [100, 100], 40, 40]]
        x['r'] += [[snap(tw), R0, 40, 40], [snap(tw + 0.25), R0 + (18.0 if k == 0 else -18.0), 40, 40], [snap(tw + 0.6), R0, 40, 40]]
    for kk in list(T): T[kk] = clean(T[kk])
    for X in (H, B):
        for kk in X: X[kk] = clean(X[kk])
    for x in dash + spk: x['s'] = clean(x['s']); x.get('p') and x.update(p=clean(x['p'])); x.get('r') and x.update(r=clean(x['r']))
    cloud_idle(CL, I, t_end)
    layers = [CL,
        {'name': 'box', 'piece': 'base'},
        {'name': 'lid', 'piece': 'lid', 'pivot': P['lid']['pivot'], 'rot': T['lid_r'], 'dy': T['lid_y']},
        {'name': 'card (covers the lid)', 'piece': 'card'},
        {'name': 'heart', 'piece': 'heart', 'pivot': P['heart']['anchor'], 'scale': H['s'], 'pos': H['p'], 'rot': H['r']},
        {'name': 'arrow badge', 'piece': 'badge', 'pivot': P['badge']['anchor'], 'scale': B['s'], 'pos': B['p'], 'rot': B['r']},
    ] + [{'name': 'dash %d' % (k + 1), 'piece': 'dash%d' % (k + 1), 'pivot': x['c'], 'scale': x['s'], 'pos': x['p']} for k, x in enumerate(dash)] \
      + [{'name': 'sparkle %d' % (k + 1), 'piece': 'sparkle%d' % (k + 1), 'pivot': x['c'], 'scale': x['s'], 'rot': x['r'], 'opacity': x['op'] * 100} for k, x in enumerate(spk)]
    return {'comp': 'GR sheet · Gift registry', 'card': 'registry', 'pieces': P, 'rig': {'pivot': rig_piv, 'scale': T['rig_s'], 'y': T['rig_y']},
            'layers': layers, 't_in': t_in, 't_end': t_end}


if __name__ == '__main__':
    comps = [collection(), registry()]
    # copy-pieces never below 100%: assert
    for c in comps:
        for L in c['layers']:
            if c['pieces'][L['piece']].get('kind') == 'copy' and 'scale' in L:
                assert min(min(k[1]) for k in L['scale']) >= 100 - 1e-6, (c['comp'], L['name'])
            for k in L.get('rot', []):          # no key may sit on ~0 deg (ThorVG raster-path pop)
                if abs(k[1]) < 0.1: k[1] = 0.15 if k[1] >= 0 else -0.15
    spec = {'w': 600, 'h': 360, 'fps': FPS, 'root': '01 Hero lotties (export these)', 'folder': 'Bottom sheet', 'artfolder': 'art (sheet pieces)',
            'piece_dir': PIECES, 'comps': comps, 'log': os.path.join(BUILD, 'build_sheet.log')}
    tpl = open(os.path.join(HERE, 'builder_tpl.jsx')).read()
    open(os.path.join(BUILD, 'build_sheet.jsx'), 'w').write(tpl.replace('/*SPEC*/null', json.dumps(spec, ensure_ascii=True)))
    for c in comps:
        print('%-28s intro end %.3f s (f%d), total %.3f s (f%d)' % (c['comp'].encode('ascii', 'replace').decode(), c['t_in'], round(c['t_in'] * FPS), c['t_end'], round(c['t_end'] * FPS)))
