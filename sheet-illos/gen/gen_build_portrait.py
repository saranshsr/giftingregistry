#!/usr/bin/env python3
"""Portrait 'Empty state' cards: art/pieces_portrait/<card>/pieces.json (portrait_prep.py) -> ../build/build_portrait.jsx,
one ExtendScript that builds 'GR card · Collection (portrait)' and 'GR card · Gift registry (portrait)' (492x360 = the
164x120 visuals box at 3x) in 01 Hero lotties (export these)/Bottom sheet/, with builder_tpl.jsx.

Same family as the landscape Create-sheet lotties (gen_build.py: same springs, PACE, timing, HOLD rests, 0.25 deg rests,
copy pieces never below 100%, markers 'intro' / 'idle', seamless 3.5 s idle). Re-fit for the portrait card:
  - every travel in px is the landscape one x k (the picture is k x bigger: 1.156 / 1.240), so it reads the same;
  - the + button (dev-built, drawn ON TOP of the lottie, box 62..102 x 0..40 pt) sits right over the lamp dome / the bow,
    which already tuck ~2 / ~8 pt under it at rest. So the moves that push art up into it are calmer than landscape:
    rig overshoot ~3% (was ~8%), lamp stretch 106% (was 112%) and a beat later, lid lift -6 deg / 2 pt (was -9 deg /
    7 px) and a beat later (heart, badge, dashes follow it), floats 3 px; measured: art rises <= ~4 pt into the button;
  - collection: two clouds (back leads, front follows 0.06 s later, opposite idle drift = a little depth) and the two
    yellow sparkles (separate Figma layers here, one image at two sizes)."""
import json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from gen_build import spring, bump, ease, clean, snap, last_t, T_, R0, INF, FPS, IDLE

PIECES = os.path.join(ROOT, 'art', 'pieces_portrait'); BUILD = os.path.join(ROOT, 'build')
W, H = 492, 360
BTN = (62 * 3, 0, 102 * 3, 40 * 3)        # + button box, comp px (for the report only)


def load(card):
    d = json.load(open(os.path.join(PIECES, card, 'pieces.json')))
    P = {L['name']: L for L in d['layers']}
    for L in d.get('clouds', []) + d.get('sparkles', []): P[L['name']] = L
    return d, P


def ctr(L): return [L['x'] + L['w'] / 2.0, L['y'] + L['h'] / 2.0]


def cloud(P, name, t0, k, drift, breathe):
    pc = P[name]; c = ctr(pc)
    L = {'name': name.replace('_', ' '), 'piece': name, 'pivot': c, 'noparent': True,
         'op_keys': ease(t0, t0 + 0.32, 0.0, 100.0 * pc['opacity'], o=25, i=80),
         'scale': spring(t0, [80, 80], [100, 100], 1.05, 0.8), 'pos': spring(t0, [c[0], c[1] + 24.0 * k], c, 1.0, 0.85),
         '_drift': drift, '_breathe': breathe}
    if t0 > 0:   # nothing before its start: hold the start pose from 0
        for kk in ('op_keys', 'scale', 'pos'): L[kk] = [[0.0, L[kk][0][1], INF, INF]] + L[kk]
    return L


def cloud_idle(L, I, t_end):
    c = L['pivot']; D = t_end - I; dx, dy = L.pop('_drift'); b = L.pop('_breathe')
    L['scale'] = clean(L['scale'] + [[I, [100, 100], 50, 50], [snap(I + D * 0.5), [b, b], 50, 50], [t_end, [100, 100], 50, 50]])
    L['pos'] = clean(L['pos'] + [[I, c, 50, 50], [snap(I + D * 0.5), [c[0] + dx, c[1] + dy], 50, 50], [t_end, c, 50, 50]])
    L['op_keys'] = clean(L['op_keys'])


RIG_Z = 0.75          # rig springs: ~3% overshoot (landscape 0.62 = ~8%), the art top sits under the + button


# ------------------------------------------------------------------ collection
def collection():
    d, P = load('collection'); k = d['k']
    CB = cloud(P, 'cloud_back', 0.0, k, (4.0 * k, -3.0 * k), 102)
    CF = cloud(P, 'cloud_front', 0.06, k, (-3.0 * k, -2.0 * k), 101.5)
    base = P['base']
    rig_piv = [base['x'] + base['w'] / 2.0, base['y'] + base['h']]     # basket's bottom middle (below the comp: the art bleeds)
    T = {}
    T['rig_s'] = spring(T_(0.0), [0, 0], [100, 100], 1.5, RIG_Z)
    T['rig_y'] = spring(T_(0.0), rig_piv[1] + 30 * k, rig_piv[1], 1.45, RIG_Z)
    T['rl_r'] = spring(T_(0.06), R0 - 14.0, R0, 1.35, 0.45)
    T['rr_r'] = spring(T_(0.10), R0 + 12.0, R0, 1.35, 0.45)
    # lamp bob a beat later than landscape (0.26): its stretch must not stack on the rig's overshoot under the + button
    T['lamp_s'] = bump(T_(0.34), [100, 100], [[102, 106], [100, 100.4], [100.6, 101.6]], 0.62 * 0.78)
    T['heart_s'] = bump(T_(0.36), [100, 100], [[124, 124], [100, 100], [105, 105]], 0.56 * 0.78)
    T['heart_r'] = bump(T_(0.36), R0, [R0 - 8.0, R0, R0 + 1.5], 0.56 * 0.78)
    T['star_s'] = spring(T_(0.40), [0, 0], [100, 100], 1.9, 0.42)
    T['star_r'] = spring(T_(0.40), R0 - 90.0, R0, 1.5, 0.58)
    sa = P['star']['anchor']; sc = [sa[0], sa[1] + 40 * k]
    dash = []
    for i in range(3):
        L = P['dash%d' % (i + 1)]; c = ctr(L)
        st = [sc[0] + (c[0] - sc[0]) * 0.55, sc[1] + (c[1] - sc[1]) * 0.55]
        t0 = T_(0.48 + 0.04 * i)
        dash.append({'c': c, 's': spring(t0, [0, 0], [100, 100], 1.8, 0.45), 'p': spring(t0, st, c, 1.5, 0.6)})
    # the two yellow sparkles (portrait only): pop in spinning, after the star, outer one first
    spk = []
    for i, t0 in enumerate((T_(0.36), T_(0.44))):
        L = P['sparkle%d' % (i + 1)]; c = ctr(L)
        spk.append({'c': c, 's': spring(t0, [0, 0], [100, 100], 1.9, 0.38), 'r': spring(t0, R0 - 70.0 * (1 if i == 0 else -1), R0, 1.4, 0.55), 'op': L['opacity']})
    t_in = snap(last_t(CB['scale'], CB['pos'], CB['op_keys'], CF['scale'], CF['pos'], CF['op_keys'], *T.values(),
                       *[x['s'] for x in dash], *[x['p'] for x in dash], *[x['s'] for x in spk], *[x['r'] for x in spk]) + 0.05)
    t_end = snap(t_in + IDLE); I = t_in; D = t_end - t_in
    # ---- idle (every track starts and ends at rest, eased: the loop seam has zero velocity on both sides)
    T['rig_y'] += [[I, rig_piv[1], 50, 50], [snap(I + D * 0.5), rig_piv[1] - 3.0, 50, 50], [t_end, rig_piv[1], 50, 50]]
    T['rl_r'] += [[I, R0, 50, 50], [snap(I + D * 0.30), R0 + 1.6, 50, 50], [snap(I + D * 0.75), R0 - 1.1, 50, 50], [t_end, R0, 50, 50]]
    T['rr_r'] += [[I, R0, 50, 50], [snap(I + D * 0.38), R0 - 1.5, 50, 50], [snap(I + D * 0.80), R0 + 1.0, 50, 50], [t_end, R0, 50, 50]]
    T['lamp_s'] += bump(I + 0.9, [100, 100], [[100, 102]], 0.9)
    T['heart_s'] += bump(I + 2.0, [100, 100], [[106, 106]], 0.7)
    T['heart_r'] += bump(I + 2.0, R0, [R0 - 3.0], 0.7)
    tw = I + 0.55
    T['star_s'] += [[snap(tw), [100, 100], 40, 40], [snap(tw + 0.16), [120, 120], 40, 40], [snap(tw + 0.34), [92, 92], 40, 40], [snap(tw + 0.52), [100, 100], 40, 40]]
    T['star_r'] += [[snap(tw), R0, 40, 40], [snap(tw + 0.22), R0 + 14.0, 40, 40], [snap(tw + 0.6), R0, 40, 40]]
    for i, x in enumerate(dash):
        x['s'] += bump(I + 0.62 + 0.07 * i, [100, 100], [[112, 112]], 0.42, inf=45)
    for i, x in enumerate(spk):
        tw = I + (1.45 if i == 0 else 2.75)
        x['s'] += [[snap(tw), [100, 100], 40, 40], [snap(tw + 0.15), [128, 128], 40, 40], [snap(tw + 0.32), [70, 70], 40, 40], [snap(tw + 0.55), [100, 100], 40, 40]]
        x['r'] += [[snap(tw), R0, 40, 40], [snap(tw + 0.25), R0 + (18.0 if i == 0 else -18.0), 40, 40], [snap(tw + 0.6), R0, 40, 40]]
    for kk in list(T): T[kk] = clean(T[kk])
    for x in dash: x['s'] = clean(x['s']); x['p'] = clean(x['p'])
    for x in spk: x['s'] = clean(x['s']); x['r'] = clean(x['r'])
    cloud_idle(CB, I, t_end); cloud_idle(CF, I, t_end)
    layers = [CB, CF,
        {'name': 'ribbon left', 'piece': 'ribbon_left', 'pivot': P['ribbon_left']['pivot'], 'rot': T['rl_r']},
        {'name': 'ribbon right', 'piece': 'ribbon_right', 'pivot': P['ribbon_right']['pivot'], 'rot': T['rr_r']},
        {'name': 'basket', 'piece': 'base'},
        {'name': 'lamp', 'piece': 'lamp', 'pivot': P['lamp']['anchor'], 'scale': T['lamp_s']},
        {'name': 'heart badge', 'piece': 'heart', 'pivot': P['heart']['anchor'], 'scale': T['heart_s'], 'rot': T['heart_r']},
        {'name': 'star', 'piece': 'star', 'pivot': P['star']['anchor'], 'scale': T['star_s'], 'rot': T['star_r']},
    ] + [{'name': 'dash %d' % (i + 1), 'piece': 'dash%d' % (i + 1), 'pivot': x['c'], 'scale': x['s'], 'pos': x['p']} for i, x in enumerate(dash)] \
      + [{'name': 'sparkle %d' % (i + 1), 'piece': 'sparkle%d' % (i + 1), 'pivot': x['c'], 'scale': x['s'], 'rot': x['r'], 'opacity': x['op'] * 100, 'noparent': True}
         for i, x in enumerate(spk)]
    return {'comp': 'GR card · Collection (portrait)', 'card': 'collection', 'pieces': P, 'rig': {'pivot': rig_piv, 'scale': T['rig_s'], 'y': T['rig_y']},
            'layers': layers, 't_in': t_in, 't_end': t_end}


# ------------------------------------------------------------------ registry
def registry():
    d, P = load('registry'); k = d['k']
    CL = cloud(P, 'cloud', 0.0, k, (4.0 * k, -3.0 * k), 102)
    base = P['base']
    rig_piv = [base['x'] + base['w'] / 2.0, base['y'] + base['h']]
    T = {}
    T['rig_s'] = spring(T_(0.0), [0, 0], [100, 100], 1.5, RIG_Z)
    T['rig_y'] = spring(T_(0.0), rig_piv[1] + 30 * k, rig_piv[1], 1.45, RIG_Z)
    # lid lift: later than landscape (0.22) so it never stacks on the rig's overshoot, and smaller (-6 deg, 2 pt):
    # the bow sits under the + button
    lid_t = T_(0.30); LT = 0.16 * 0.78
    LR, LY = -6.0, -2.0 * 3
    T['lid_r'] = [[0.0, R0, INF, INF]] + ease(lid_t, lid_t + LT, R0, R0 + LR, o=20, i=70) + spring(lid_t + LT, R0 + LR, R0, 1.45, 0.45)[1:]
    T['lid_y'] = [[0.0, 0.0, INF, INF]] + ease(lid_t, lid_t + LT, 0.0, LY, o=20, i=70) + spring(lid_t + LT, LY, 0.0, 1.6, 0.55)[1:]

    def float_out(name, t0, off, spin, s0=25):
        L = P[name]; a = L['anchor']
        return {'s': spring(t0, [s0, s0], [100, 100], 1.55, 0.45),
                'p': spring(t0, [a[0] + off[0] * k, a[1] + off[1] * k], a, 1.5, 0.6),
                'r': spring(t0, R0 + spin, R0, 1.5, 0.55)}
    Hh = float_out('heart', T_(0.38), [14, 12], -14.0, s0=62)     # (landscape 0.34 / 0.42: kept after the lid)
    B = float_out('badge', T_(0.46), [-30, 20], 22.0, s0=0)
    ba = P['badge']['anchor']
    sc = [ba[0] - 3.5 * k, ba[1] - 18.5 * k]       # dashes radiate from the badge's upper left (landscape 495,160)
    dash = []
    for i in range(3):
        L = P['dash%d' % (i + 1)]; c = ctr(L)
        st = [sc[0] + (c[0] - sc[0]) * 0.55, sc[1] + (c[1] - sc[1]) * 0.55]
        t0 = T_(0.54 + 0.04 * i)
        dash.append({'c': c, 's': spring(t0, [0, 0], [100, 100], 1.8, 0.45), 'p': spring(t0, st, c, 1.5, 0.6)})
    t_in = snap(last_t(CL['scale'], CL['pos'], CL['op_keys'], *T.values(), *Hh.values(), *B.values(),
                       *[x['s'] for x in dash], *[x['p'] for x in dash]) + 0.05)
    t_end = snap(t_in + IDLE); I = t_in; D = t_end - t_in
    T['rig_y'] += [[I, rig_piv[1], 50, 50], [snap(I + D * 0.5), rig_piv[1] - 3.0, 50, 50], [t_end, rig_piv[1], 50, 50]]
    T['lid_r'] += bump(I + 1.55, R0, [R0 - 1.6, R0 + 0.3], 0.75)
    ha = P['heart']['anchor']
    Hh['p'] += [[I, ha, 50, 50], [snap(I + D * 0.45), [ha[0], ha[1] - 6.0 * k], 50, 50], [t_end, ha, 50, 50]]
    Hh['r'] += [[I, R0, 50, 50], [snap(I + D * 0.30), R0 - 4.0, 50, 50], [snap(I + D * 0.72), R0 + 2.5, 50, 50], [t_end, R0, 50, 50]]
    B['p'] += [[I, ba, 50, 50], [snap(I + D * 0.62), [ba[0], ba[1] - 5.0 * k], 50, 50], [t_end, ba, 50, 50]]
    B['r'] += [[I, R0, 50, 50], [snap(I + D * 0.55), R0 + 5.0, 50, 50], [t_end, R0, 50, 50]]
    for i, x in enumerate(dash):
        x['s'] += bump(I + 1.05 + 0.07 * i, [100, 100], [[112, 112]], 0.42, inf=45)
    for kk in list(T): T[kk] = clean(T[kk])
    for X in (Hh, B):
        for kk in X: X[kk] = clean(X[kk])
    for x in dash: x['s'] = clean(x['s']); x['p'] = clean(x['p'])
    cloud_idle(CL, I, t_end)
    layers = [CL,
        {'name': 'box', 'piece': 'base'},
        {'name': 'lid', 'piece': 'lid', 'pivot': P['lid']['pivot'], 'rot': T['lid_r'], 'dy': T['lid_y']},
        {'name': 'card (covers the lid)', 'piece': 'card'},
        {'name': 'heart', 'piece': 'heart', 'pivot': ha, 'scale': Hh['s'], 'pos': Hh['p'], 'rot': Hh['r']},
        {'name': 'arrow badge', 'piece': 'badge', 'pivot': ba, 'scale': B['s'], 'pos': B['p'], 'rot': B['r']},
    ] + [{'name': 'dash %d' % (i + 1), 'piece': 'dash%d' % (i + 1), 'pivot': x['c'], 'scale': x['s'], 'pos': x['p']} for i, x in enumerate(dash)]
    return {'comp': 'GR card · Gift registry (portrait)', 'card': 'registry', 'pieces': P, 'rig': {'pivot': rig_piv, 'scale': T['rig_s'], 'y': T['rig_y']},
            'layers': layers, 't_in': t_in, 't_end': t_end}


if __name__ == '__main__':
    comps = [collection(), registry()]
    for c in comps:
        for L in c['layers']:
            if c['pieces'][L['piece']].get('kind') == 'copy' and 'scale' in L:
                assert min(min(kk[1]) for kk in L['scale']) >= 100 - 1e-6, (c['comp'], L['name'])
            for kk in L.get('rot', []):
                if abs(kk[1]) < 0.1: kk[1] = 0.15 if kk[1] >= 0 else -0.15
    spec = {'w': W, 'h': H, 'fps': FPS, 'root': '01 Hero lotties (export these)', 'folder': 'Bottom sheet', 'artfolder': 'art (portrait card pieces)',
            'piece_dir': PIECES, 'comps': comps, 'log': os.path.join(BUILD, 'build_portrait.log')}
    tpl = open(os.path.join(HERE, 'builder_tpl.jsx')).read()
    open(os.path.join(BUILD, 'build_portrait.jsx'), 'w').write(tpl.replace('/*SPEC*/null', json.dumps(spec, ensure_ascii=True)))
    for c in comps:
        print('%-36s intro end %.3f s (f%d), total %.3f s (f%d), %d layers' % (c['comp'].encode('ascii', 'replace').decode(), c['t_in'], round(c['t_in'] * FPS),
                                                                             c['t_end'], round(c['t_end'] * FPS), len(c['layers'])))
