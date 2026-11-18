#!/usr/bin/env python3
"""Gift Registry page heroes -> build/heroes.jsx (one ExtendScript that builds every hero comp, bg-free).
House style (nano-ae-motion): every element moves on its own, springs with overshoot (PACE 1.45), staggered, no exit,
the last frame is the Figma still, rests are HOLD keys (exporters mangle equal-value bezier rests into jumps)."""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
ART = os.path.join(ROOT, 'art'); BUILD = os.path.join(ROOT, 'build'); os.makedirs(BUILD, exist_ok=True)
PACE, FPS, INF = 1.45, 60.0, 36
ORDER = ['p5', 'p1', 'p2', 'p3', 'p4', 'p6']            # flow order: 1.1, 1.3, 1.4, 2.3, 2.5, name
NAMES = {'p5': 'GR hero 1.1 Occasion', 'p1': 'GR hero 1.3 When is it', 'p2': 'GR hero 1.4 Delivery details',
         'p3': 'GR hero 2.3 Whose birthday', 'p4': 'GR hero 2.5 Due date', 'p6': 'GR hero Name your registry'}


def snap(t): return round(t * FPS) / FPS


def spring_keys(t0, v0, v1, f, zeta, settle=0.004):
    w = 2 * math.pi * f * PACE; wd = w * math.sqrt(1 - zeta * zeta)
    lerp = lambda x: [a + (b - a) * x for a, b in zip(v0, v1)] if isinstance(v0, list) else v0 + (v1 - v0) * x
    out = [[snap(t0), lerp(0.0), INF, INF]]; k = 1
    while True:
        tk = k * math.pi / wd; amp = math.exp(-zeta * w * tk)
        if amp < settle: out.append([snap(t0 + tk), lerp(1.0), INF, INF]); break
        out.append([snap(t0 + tk), lerp(1 - amp * (-1) ** k), INF, INF]); k += 1
    return out


def r(v): return [round(x, 2) for x in v] if isinstance(v, list) else round(v, 3)
def clean(keys): return [[k[0], r(k[1]), k[2], k[3]] for k in keys]


def page_spec(pg, H=None, name=None, folder=None):
    H = H or json.load(open(os.path.join(ART, pg, 'hero.json')))
    F = H['files']
    piv = H['ill_base']; land_y = piv[1]
    T_ILL, T_BITS, T_SW, T_TITLE = 0.10, 0.34, 0.36, 0.14   # title pops with the illustration (user, 16 Nov; was 0.58)
    intro_y = spring_keys(T_ILL, land_y + 42, land_y, 1.3, 0.62)
    idle = [[snap(max(1.30, intro_y[-1][0] + 0.05)), land_y, 50, 50], [snap(2.15), land_y - 6, 50, 50], [snap(3.0), land_y, 50, 50]]
    L = {'ill': {'pivot': piv, 'scale': clean(spring_keys(T_ILL, [0, 0], [100, 100], 1.55, 0.45)),
                 'rot': clean(spring_keys(T_ILL, -8.0, 0.0, 1.3, 0.5)), 'y': clean(intro_y + idle)}}
    # bits: burst out of the illustration, nearest first; the big ones (stars) spin in and twinkle once
    c0 = H['ill_center']; bits = []
    def cen(k): f = F[k]; return [f['x'] + f['w'] / 2, f['y'] + f['h'] / 2]
    order = sorted(H['bits'], key=lambda b: (cen(b['key'])[0] - c0[0]) ** 2 + (cen(b['key'])[1] - c0[1]) ** 2)
    nbig = 0
    for i, b in enumerate(order):
        c = cen(b['key']); st = [c0[0] + (c[0] - c0[0]) * 0.55, c0[1] + (c[1] - c0[1]) * 0.55]
        t0 = T_BITS + i * (0.035 if len(order) > 4 else 0.06)
        e = {'key': b['key'], 'scale': clean(spring_keys(t0, [0, 0], [100, 100], 1.8, 0.45)), 'pos': clean(spring_keys(t0, st, c, 1.5, 0.6))}
        if b['area'] > 2500:
            spin = -70.0 if c[0] < c0[0] else 70.0
            rot = spring_keys(t0, spin, 0.0, 1.4, 0.55)
            tt = 1.85 + 0.42 * nbig; nbig += 1
            tw = [[snap(tt), [100, 100], 40, 40], [snap(tt + 0.14), [122, 122], 40, 40], [snap(tt + 0.30), [93, 93], 40, 40], [snap(tt + 0.48), [100, 100], 40, 40]]
            if tt + 0.5 < 3.05 and e['scale'][-1][0] < tt: e['scale'] = e['scale'] + clean(tw)
            e['rot'] = clean(rot)
        bits.append(e)
    L['bits'] = bits
    L['swoosh'] = {'trim': [[snap(T_SW), 0.0, 33, 25], [snap(T_SW + 0.72), 100.0, 80, 33]]}
    # title: letters pop from their line's baseline, 17 ms apart in reading order, a short breath between lines
    tp = []; t = T_TITLE; prev_line = 0
    for p in H['title']:
        if p['line'] != prev_line: t += 0.06; prev_line = p['line']
        sc = spring_keys(t, [0, 0], [100, 100], 2.0, 0.55 if p['line'] == 0 else 0.5)
        tp.append({'pivot': p['pivot'], 'paths': p['paths'], 'outers': p['outers'], 'scale': clean(sc)}); t += 0.017
    L['title'] = tp
    L['shadow_op'] = [[snap(T_TITLE + 0.25), 0.0, 33, 40], [snap(T_TITLE + 0.85), 100.0, 60, 33]]
    files = ['sw', 'ill', 'ill_a', 'title_grad', 'title_shadow'] + [b['key'] for b in H['bits']]
    return {'page': pg, 'name': name or NAMES[pg], 'folder': folder, 'title': H['title_text'], 'frame': H['figma_frame'], 'w': H['comp'][0], 'h': H['comp'][1],
            'art_dir': os.path.join(ART, pg), 'files': {k: F[k] for k in files}, 'L': L, 'outline_px': 30}


if __name__ == '__main__':
    specs = [page_spec(pg) for pg in ORDER]
    tpl = open(os.path.join(HERE, 'hero_tpl.jsx')).read()
    S = {'pages': specs, 'dur': 3.4, 'fps': 60, 'root': '01 Hero lotties (export these)', 'log': os.path.join(BUILD, 'heroes.log')}
    open(os.path.join(BUILD, 'heroes.jsx'), 'w').write(tpl.replace('/*SPEC*/null', json.dumps(S, ensure_ascii=True)))
    for s_ in specs:
        last = max([k[0] for k in s_['L']['ill']['y']] + [k[0] for p in s_['L']['title'] for k in p['scale']] + [k[0] for b in s_['L']['bits'] for k in b['scale']] or [0])
        print('%-30s letters %2d  bits %2d  last key %.2fs' % (s_['name'], len(s_['L']['title']), len(s_['L']['bits']), last))
    print('heroes.jsx %.0f KB' % (len(json.dumps(S)) / 1024))
