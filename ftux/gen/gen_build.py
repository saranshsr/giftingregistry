#!/usr/bin/env python3
"""GR FTUX "What is a Gift Registry?" lottie: ../art/prep.json + ../art/rays_source.json -> ../build/build_ftux.jsx

One ExtendScript that builds, in 01 Hero lotties (export these)/FTUX/:
  GR FTUX · What is a Gift Registry       1053 x 1252 (351 x 417.33 pt at 3x: the card down to the CTA top), 60 fps
    hero bg (Figma Onboarding background) -> rays precomp -> hero art precomp -> per column: divider, icon, number, text
  GR FTUX · rays                           1053 x 618, the hero box (the precomp clips the beams to the hero)
  GR FTUX · hero art (studio 17 Nov copy)  a NEW duplicate of 'gifting v2 (no bg) (studio 17 Nov)', lengthened to the
                                           FTUX duration, its float/twinkles moved into the idle loop (originals untouched)

Timing (s from the lottie start; the proto's t0 = 0.18 is dropped, everything starts at 0):
  background fades 0 -> 0.42; hero art from ~0.1 (its own entrance); rays bloom with it and sweep forever
  col(i) = 0.2 + 0.06 i: icon pops (0.7 / +6 pt), number pops +0.03 (0.5 / -8 deg), text slides +0.05 (x +14 pt),
  divider draws +0.12 (scale-Y 0.6). Pops = the proto's POP spring (300/22/1), slides = MOVE (300/28/1).
Markers: intro 0 -> T_IN, idle T_IN -> T_END (4.0 s = one ray cycle; only the rays and the hero's float move; last frame
equals the first). Rules: equal neighbours -> HOLD (builder); rotating images never rest at 0 deg (+0.25)."""
import json, math, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
ART = os.path.join(ROOT, 'art'); BUILD = os.path.join(ROOT, 'build'); os.makedirs(BUILD, exist_ok=True)
FPS = 60.0
S = 3
W, H = 1053, 1252          # 351 pt x (417.4545 pt CTA top -> 1252.36 px, floored so the lottie never reaches under the CTA)
HERO_W, HERO_H = 1053, 618
T_IN = 1.5                 # the hero art's last entrance key is f89
IDLE = 4.0                 # = the ray loop (240 f)
T_END = T_IN + IDLE
R0 = 0.25

# rays: where the beams come from and how big (hero px). The pivot sits inside the open box, so the box body hides the
# beams' bright U-shaped roots and the light reads as coming out of the gift.
RAY_PIVOT = [528.0, 372.0]
RAY_K = 0.80               # source px -> hero px
RAY_OPACITY = 70.0         # whole-precomp strength
info = json.load(open(os.path.join(ART, 'prep.json')))


def snap(t): return round(t * FPS) / FPS


def r3(v): return [round(float(x), 3) for x in v] if isinstance(v, (list, tuple, np.ndarray)) else round(float(v), 3)


# ------------------------------------------------------------------ easing fits
def bez_y_at_x(o, i, xs):
    s = np.linspace(0, 1, 400)
    bx = 3 * (1 - s) ** 2 * s * o + 3 * (1 - s) * s ** 2 * (1 - i) + s ** 3
    by = 3 * (1 - s) * s ** 2 + s ** 3
    return np.interp(xs, bx, by)


_GRID = [x / 100.0 for x in range(4, 97, 2)]


def fit_seg(f):
    """f: normalised progress samples on uniform time 0..1 (0 -> 1). -> (out influence, in influence) in %"""
    xs = np.linspace(0, 1, len(f)); best = None
    for o in _GRID:
        for i in _GRID:
            e = np.abs(bez_y_at_x(o, i, xs) - f).max()
            if best is None or e < best[0]: best = (e, o, i)
    return best[1] * 100, best[2] * 100


def spring(t0, v0, v1, k=300.0, c=22.0, m=1.0, settle=0.02):
    """keys [t, v, in%, out%] at the extremes of a damped spring v0 -> v1 (zero velocity at each key), each segment's
    ease fitted to the real spring curve."""
    w = math.sqrt(k / m); z = c / (2 * math.sqrt(k * m)); wd = w * math.sqrt(1 - z * z)
    x = lambda t: math.exp(-z * w * t) * (math.cos(wd * t) + z * w / wd * math.sin(wd * t))   # 1 -> 0, x'(0)=0
    ext = []; n = 1
    while True:
        tk = n * math.pi / wd; ext.append(tk)
        if abs(x(tk)) < settle: break
        n += 1
    ts = [0.0] + ext
    vals = [1.0] + [x(t) for t in ext]; vals[-1] = 0.0
    keys = [[t0, v0, 33, 33]]
    for a in range(len(ts) - 1):
        ta, tb = ts[a], ts[a + 1]
        tt = np.linspace(ta, tb, 60); xa, xb = x(ta), (x(tb) if a < len(ts) - 2 else x(tb))
        f = (np.array([x(t) for t in tt]) - xa) / (xb - xa)
        o, i = fit_seg(f)
        keys[-1][3] = o
        frac = vals[a + 1]
        v = [p1 + (p0 - p1) * frac for p0, p1 in zip(v0, v1)] if isinstance(v0, list) else v1 + (v0 - v1) * frac
        keys.append([t0 + tb, v, i, 33])
    return keys


def ease(t0, t1, v0, v1, o=33, i=85): return [[t0, v0, 33, o], [t1, v1, i, 33]]


EASE_OUT = (8, 72)          # ~ the kit's easing.out cubic-bezier(.215,.61,.355,1) with zero-speed handles


def fade(t0, dur, to=100.0): return ease(t0, t0 + dur, 0.0, to, *EASE_OUT)


def clean(keys):
    out = []
    for k in keys:
        k = [snap(k[0]), r3(k[1]), round(float(k[2]), 1), round(float(k[3]), 1)]
        if out and abs(out[-1][0] - k[0]) < 1e-9: out[-1] = k; continue
        out.append(k)
    return out


# ------------------------------------------------------------------ rays (rebuilt from the source's baked keys)
SRC = json.load(open(os.path.join(ART, 'rays_source.json')))
IMG = {'img_0': 'ray_b.png', 'img_1': 'ray_d.png', 'img_2': 'ray_c.png', 'img_3': 'ray_a.png'}
SRC_PIVOT = SRC['layers'][0]['ks']['p']['k'][:2]


def sampled(prop, dim):
    ks = prop['k']; t = np.array([k['t'] for k in ks], float); v = np.array([k['s'][dim] for k in ks], float)
    return np.interp(np.arange(240), t, v)


def sine_fit(y):
    """every source track is one sinusoid (harmonic 1 or 2 of the 240 f loop): mean, amplitude, harmonic, time of a max"""
    F = np.fft.rfft(y - y.mean()); h = int(np.argmax(np.abs(F[1:6]))) + 1
    A = np.abs(F[h]) * 2 / len(y); ph = np.angle(F[h])
    P = 240.0 / h; tmax = (-ph / (2 * math.pi) * P) % P
    resid = np.abs(y.mean() + A * np.cos(2 * math.pi * (np.arange(240) - tmax) / P) - y).max()
    return y.mean(), A, h, tmax, resid


def sine_keys(tracks, t_from, t_to):
    """tracks: list of (mean, amp, h, tmax) sharing h and tmax -> keys at every extreme covering [t_from, t_to] (frames)"""
    M = [tr[0] for tr in tracks]; A = [tr[1] for tr in tracks]; h, tmax = tracks[0][2], tracks[0][3]
    half = 120.0 / h
    n0 = math.floor((t_from - tmax) / half); n1 = math.ceil((t_to - tmax) / half)
    keys = []
    for n in range(n0, n1 + 1):
        t = tmax + n * half; sgn = 1 if n % 2 == 0 else -1
        v = [m + sgn * a for m, a in zip(M, A)]
        keys.append([round(t) / FPS, v if len(v) > 1 else v[0], 37, 37])   # 37% = ease-in-out-sine
    return keys


rays = []; fitlog = []
T_LAST = T_END * FPS + 1
for L in SRC['layers']:
    ks = L['ks']; lay = {'name': L['nm'].lower().replace('_', ' '), 'file': IMG[L['refId']], 'anchor': ks['a']['k'][:2]}
    fo = sine_fit(sampled(ks['o'], 0)); fr = sine_fit(sampled(ks['r'], 0))
    fsx = sine_fit(sampled(ks['s'], 0)); fsy = sine_fit(sampled(ks['s'], 1))
    assert fsx[2] == fsy[2] and abs((fsx[3] - fsy[3] + 120) % (240 / fsx[2]) - 120 % (240 / fsx[2])) < 3, (L['nm'], fsx, fsy)
    fitlog.append((L['nm'], [round(f[4], 3) for f in (fo, fr, fsx, fsy)]))
    # the whole-rays strength is baked into each beam's opacity: lottie-web ignores a precomp layer's opacity (anything
    # but 0 renders at 100%), so the precomp itself stays at 100 and nothing fades it
    lay['op'] = sine_keys([(fo[0] * RAY_OPACITY / 100.0, fo[1] * RAY_OPACITY / 100.0, fo[2], fo[3])], -1, T_LAST)
    lay['rot'] = sine_keys([fr], -1, T_LAST)
    lay['scale'] = sine_keys([fsx, (fsy[0], fsy[1], fsx[2], fsx[3])], -1, T_LAST)
    for k in lay['rot']: assert abs(k[1]) > 0.1          # rotation keys are extremes, never a rest at 0
    rays.append(lay)
# bloom: the rig grows from the pivot with the gift's entrance. No fade of their own: the beams are cool white, invisible on
# the white sheet until the sky fades in under them (0 -> 0.42 s), so they arrive with the background
RAYS = {'pivot': RAY_PIVOT, 'k': RAY_K, 'layers': rays,
        'rig_scale': clean(ease(0.0, 1.10, [RAY_K * 55, RAY_K * 55], [RAY_K * 100, RAY_K * 100], o=18, i=88)),
        'opacity': None}
for L in rays:
    L['op'] = clean(L['op']); L['rot'] = clean(L['rot']); L['scale'] = clean(L['scale'])

# ------------------------------------------------------------------ hero copy: idle edits (frames -> s)
F = lambda f: f / FPS
HERO = {
    'src': 'gifting v2 (no bg) (studio 17 Nov)',
    # [layer, matchName, keep keys up to (s), new keys] - the float now starts after the entrance and ends at rest on T_END
    'retime': [
        ['gift rig', 'ADBE Position_1', F(67), [[F(90), 517, 50, 50], [F(210), 511, 50, 50], [F(330), 517, 50, 50]]],
        ['lid', 'ADBE Position_1', F(67), [[F(96), -166, 50, 50], [F(200), -171, 50, 50], [F(330), -166, 50, 50]]],
        ['heart big', 'ADBE Position_1', F(83), [[F(104), -129, 50, 50], [F(214), -133, 50, 50], [F(330), -129, 50, 50]]],
        ['heart small', 'ADBE Position_1', F(89), [[F(112), -113, 50, 50], [F(226), -116, 50, 50], [F(330), -113, 50, 50]]],
    ],
    # [layer, matchName, keys from (s) move by (s)]: the star twinkles land inside the idle
    'shift': [
        ['star green', 'ADBE Scale', F(94), F(150 - 94)], ['star green', 'ADBE Rotate Z', F(94), F(150 - 94)],
        ['star grey', 'ADBE Scale', F(119), F(236 - 119)], ['star grey', 'ADBE Rotate Z', F(119), F(236 - 119)],
    ],
    # rotating image layers that rested on exactly 0 deg get +0.25 on every key from their landing key on
    'rest_r0': [['star green', F(65)], ['star grey', F(71)]],
}

# ------------------------------------------------------------------ columns
P = info['pieces']
cols = []
for i in range(3):
    c = 0.2 + 0.06 * i
    cx = (58.5 + 117 * i) * S
    ico, num, txt = P['ico%d' % (i + 1)], P['num%d' % (i + 1)], P['txt%d' % (i + 1)]
    ico_c = [cx, (226 + 53.454544 / 2) * S]                  # the img box centre (motion's transform origin)
    num_c = [cx, (287.5 + 30.14 / 2) * S]
    col = {'i': i}
    col['ico'] = {'piece': ico, 'pivot': ico_c,
                  'scale': clean(spring(c, [70, 70], [100, 100])),
                  'pos': clean(spring(c, [ico_c[0], ico_c[1] + 6 * S], ico_c)),
                  'op': clean(fade(c, 0.2))}
    cn = c + 0.03
    col['num'] = {'piece': num, 'pivot': num_c,
                  'scale': clean(spring(cn, [50, 50], [100, 100])),
                  'rot': clean(spring(cn, R0 - 8.0, R0)),
                  'op': clean(fade(cn, 0.2))}
    ct = c + 0.05
    tc = [txt['x'] + txt['w'] / 2.0, txt['y'] + txt['h'] / 2.0]
    col['txt'] = {'piece': txt, 'pivot': tc,
                  'pos': clean(spring(ct, [tc[0] + 14 * S, tc[1]], tc, c=28.0)),
                  'op': clean(fade(ct, 0.28))}
    if i < 2:
        d = info['dividers'][i]
        col['div'] = {'x': d['x'], 'y0': d['y0'], 'len': d['y1'] - d['y0'], 'w': d['w'], 'color': [x / 255.0 for x in d['color']],
                      'scale': clean(spring(c + 0.12, [100, 60], [100, 100], c=28.0)), 'op': clean(fade(c + 0.12, 0.28))}
    cols.append(col)

BG = {'piece': P['hero_bg'], 'op': clean(fade(0.0, 0.42))}

t_last = max(k[0] for col in cols for part in col.values() if isinstance(part, dict) for kk in ('scale', 'pos', 'rot', 'op') for k in part.get(kk, []))
assert t_last < T_IN, t_last

spec = {'w': W, 'h': H, 'hero_w': HERO_W, 'hero_h': HERO_H, 'fps': FPS, 't_in': T_IN, 't_end': T_END,
        'root': '01 Hero lotties (export these)', 'folder': 'FTUX', 'artfolder': 'art (ftux)', 'art_dir': ART,
        'main': u'GR FTUX · What is a Gift Registry', 'rays_comp': u'GR FTUX · rays',
        'hero_comp': u'GR FTUX · hero art (studio 17 Nov copy)', 'tag': 'gr-ftux-build',
        'hero': HERO, 'rays': RAYS, 'bg': BG, 'cols': cols, 'log': os.path.join(BUILD, 'build_ftux.log')}
tpl = open(os.path.join(HERE, 'builder_tpl.jsx')).read()
open(os.path.join(BUILD, 'build_ftux.jsx'), 'w').write(tpl.replace('/*SPEC*/null', json.dumps(spec, ensure_ascii=True)))
print('ray fits (max residual per track o/r/sx/sy):', fitlog)
print('columns land by %.3f s; intro %.2f s (f%d), end %.2f s (f%d)' % (t_last, T_IN, round(T_IN * FPS), T_END, round(T_END * FPS)))
print('ico1 scale', cols[0]['ico']['scale']); print('num1 rot', cols[0]['num']['rot']); print('txt1 pos', cols[0]['txt']['pos'])
