#!/usr/bin/env python3
"""Gift Registry icon lotties (18 Nov asset pack): placement.json + bboxes.json -> build/build_icons.jsx.

House style = the bottom-sheet hero (v2/gen/gen_build.py): every element moves on its own on a damped spring with a
little overshoot (PACE 1.45), staggered, no exit; one small idle accent; everything rests by 3.0 s and the last frame
is the reference still. 600 x 600, 60 fps, 3.4 s, transparent. Rotations carry a fixed +0.25 deg (dotLottie/ThorVG
draws an image layer at exactly 0 deg on a different path and it pops ~1 px).

Each layer spec: file, placement (x, y, s), pivot (comp px), and keyed tracks
  dx, dy (px offset of the pivot), sc ([x%, y%] on top of the placement scale), rot (deg), op (%).
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
BUILD = os.path.join(ROOT, 'build'); os.makedirs(BUILD, exist_ok=True)
PL = json.load(open(os.path.join(HERE, 'placement.json')))
BB = json.load(open(os.path.join(HERE, 'bboxes.json')))
PACE, FPS, INF, DUR, REST = 1.45, 60.0, 36, 3.4, 3.0
ROT0 = 0.25


def snap(t): return round(t * FPS) / FPS


class Keys(list):
    """A key run plus what made it (for the spec page): meta = {kind: spring|wave|fade|bump|twinkle, ...}."""
    def __init__(self, keys, **meta):
        super().__init__(keys); self.meta = meta


def spring(t0, v0, v1, f, zeta, settle=0.004):
    """Keys at the extremes of a damped spring v0 -> v1 (zero velocity at each)."""
    w = 2 * math.pi * f * PACE; wd = w * math.sqrt(1 - zeta * zeta)
    lerp = lambda x: [a + (b - a) * x for a, b in zip(v0, v1)] if isinstance(v0, list) else v0 + (v1 - v0) * x
    out = [[snap(t0), lerp(0.0), INF, INF]]
    k = 1
    while True:
        tk = k * math.pi / wd; amp = math.exp(-zeta * w * tk)
        if amp < settle:
            out.append([snap(t0 + tk), lerp(1.0), INF, INF]); break
        out.append([snap(t0 + tk), lerp(1 - amp * (-1) ** k), INF, INF]); k += 1
    return Keys(out, kind='spring', t0=snap(t0), v0=v0, v1=v1, f=f, zeta=zeta, w=w, end=out[-1][0])


def wave(t0, vals, step, inf=45):
    """Gentle sine-like accent through vals (first and last = rest)."""
    k = [[snap(t0 + i * step), v, inf, inf] for i, v in enumerate(vals)]
    return Keys(k, kind='wave', t0=k[0][0], end=k[-1][0], vals=vals)


def fade(t0, d=0.12):
    return Keys([[0.0, 0.0, 33, 33], [snap(t0), 0.0, 33, 50], [snap(t0 + d), 100.0, 60, 33]], kind='fade', t0=snap(t0), end=snap(t0 + d),
                v0=0.0, v1=100.0)


def r2(v): return [round(x, 2) for x in v] if isinstance(v, list) else round(v, 3)


def join(*parts):
    """Concatenate key runs; a run starting at t0 > 0 is preceded by a hold of its first value from 0."""
    out = []
    for p in parts:
        if not p: continue
        if not out and p[0][0] > 0: out.append([0.0, p[0][1], 33, 33])
        if out and abs(out[-1][0] - p[0][0]) < 1e-9: out.pop()
        assert not out or out[-1][0] < p[0][0], ('overlap', out[-1][0], p[0][0])
        out += p
    assert out[-1][0] <= REST + 1e-9, ('rests too late', out[-1][0])
    return [[k[0], r2(k[1]), k[2], k[3]] for k in out]


# ---------------------------------------------------------------- geometry
class Icon:
    def __init__(self, key, comp, slug):
        self.key, self.comp, self.slug = key, comp, slug
        self.parts = {p['name'].replace(key + '_', ''): p for p in PL[key]}
        self.order = [p['name'].replace(key + '_', '') for p in PL[key]]   # front -> back
        self.layers = {}

    def pt(self, part, which):
        """A point of a part in comp px: 'c' centre, 'base' lowest-6 % centroid, 'top', 'bottom', 'left', 'right'."""
        p = self.parts[part]; b = BB[p['file']]; s = p['s']
        to = lambda u, v: [round(p['x'] + u * s, 2), round(p['y'] + v * s, 2)]
        if which == 'c': return to(*b['c'])
        if which == 'base': return to(*b['base'])
        if which == 'bottom': return to(b['c'][0], b['b'])
        if which == 'top': return to(b['c'][0], b['t'])
        raise KeyError(which)

    def add(self, part, pivot, **tracks):
        p = self.parts[part]
        self.layers[part] = {'name': part.replace('_', ' ').lower(), 'file': p['file'], 'x': p['x'], 'y': p['y'], 's': p['s'],
                             'pivot': pivot, **{k: join(*v) if isinstance(v, tuple) else join(v) for k, v in tracks.items()}}
        runs = lambda v: v if isinstance(v, tuple) else (v,)
        self.layers[part]['doc'] = {k: [getattr(r, 'meta', {'kind': 'keys'}) for r in runs(v) if r] for k, v in tracks.items()}

    def spec(self, order=None):
        order = order or self.order
        missing = set(self.parts) - set(self.layers)
        assert not missing, (self.key, missing)
        return {'comp': self.comp, 'slug': self.slug, 'layers': [self.layers[n] for n in order]}


# ---------------------------------------------------------------- vocabulary
def pop(ic, part, t0, spin=0.0, f=1.9, zeta=0.40, pivot=None, frm=None, tw=None):
    """Scale 0 -> 100 with a spin that settles; optional flight from `frm` (comp px) and a twinkle at `tw`."""
    piv = pivot or ic.pt(part, 'c')
    sc = [spring(t0, [0, 0], [100, 100], f, zeta)]
    rot = [spring(t0, spin, 0.0, 1.4, 0.55)] if spin else []
    if tw is not None:
        sc.append(Keys([[snap(tw), [100, 100], 40, 40], [snap(tw + 0.14), [122, 122], 40, 40], [snap(tw + 0.30), [93, 93], 40, 40],
                        [snap(tw + 0.48), [100, 100], 40, 40]], kind='twinkle', t0=snap(tw), end=snap(tw + 0.48)))
        rot.append(Keys([[snap(tw), 0.0, 40, 40], [snap(tw + 0.2), 14.0 * (1 if spin <= 0 else -1), 40, 40], [snap(tw + 0.55), 0.0, 40, 40]],
                        kind='twinkle', t0=snap(tw), end=snap(tw + 0.55)))
    tr = {'sc': tuple(sc)}
    if rot: tr['rot'] = tuple(rot)
    if frm:
        tr['dx'] = spring(t0, frm[0] - piv[0], 0.0, 1.5, 0.6)
        tr['dy'] = spring(t0, frm[1] - piv[1], 0.0, 1.5, 0.6)
    ic.add(part, piv, **tr)


def rise(t0, dy=40.0, tilt=-8.0):
    """The hero object springs up from its base: scale 0 -> 100, a small tilt and a lift that settle."""
    return {'sc': spring(t0, [0, 0], [100, 100], 1.55, 0.45), 'rot': spring(t0, tilt, 0.0, 1.3, 0.5),
            'dy': spring(t0, dy, 0.0, 1.3, 0.62)}


def drop(t0, dy=-50.0, f=1.6, zeta=0.40):
    return {'dy': spring(t0, dy, 0.0, f, zeta), 'op': fade(t0, 0.10)}


def bump(t0, amt=12.0):
    return Keys([[snap(t0), [100, 100], 40, 40], [snap(t0 + 0.14), [100 + amt, 100 + amt], 40, 40],
                 [snap(t0 + 0.30), [100 - amt * 0.35, 100 - amt * 0.35], 40, 40], [snap(t0 + 0.48), [100, 100], 40, 40]],
                kind='bump', t0=snap(t0), end=snap(t0 + 0.48), amt=amt)


def burst_order(ic, parts, origin):
    return sorted(parts, key=lambda q: sum((a - b) ** 2 for a, b in zip(ic.pt(q, 'c'), origin)))


def calendar(ic, t0=0.10):
    """Calendar with its binder rings threaded into the punch holes (gen/prep.py calendar_rings): the rings ride with the
    calendar on the same pivot and keys, so the seam always stays inside its hole."""
    k = ic.key
    piv = ic.pt('Calendar', 'bottom'); R = rise(t0, dy=40.0, tilt=-6.0)
    ic.parts['Calendar'] = {**ic.parts['Calendar'], 'file': 'art/%s_Calendar_Holes.png' % k}
    ic.add('Calendar', piv, **R)
    for side in ('Ring_Left', 'Ring_Right'):
        ic.parts[side + '_Front'] = {**ic.parts[side], 'name': '%s_%s_Front' % (k, side), 'file': 'art/%s_%s_Front.png' % (k, side)}
        ic.add(side, piv, **R)
        ic.add(side + '_Front', piv, **R)


ICONS = []

# ---------------------------------------------------------------- 1.1 Occasion: the popper fires
ic = Icon('Occasion', 'GR icon 1.1 Occasion', 'occasion')
can_piv = ic.pt('Canister', 'bottom')
p = ic.parts['Canister']; b = BB[p['file']]
mouth = [round(p['x'] + 132 * p['s'], 2), round(p['y'] + 34.5 * p['s'], 2)]
R = rise(0.10, dy=44.0, tilt=-7.0)
ic.add('Canister', can_piv, **R)
ic.parts['Canister_Front'] = {**p, 'name': 'Occasion_Canister_Front', 'file': 'art/Occasion_Canister_Front.png'}
ic.add('Canister_Front', can_piv, **R)
for k, part in enumerate(('Spray_Inner_Left', 'Spray_Inner_Right', 'Spray_Left', 'Spray_Right')):
    # the long version (stem continued into the canister, gen/prep.py): same top-left, so placement holds
    ic.parts[part] = {**ic.parts[part], 'file': 'art/Occasion_' + part + '_Long.png'}
    ic.add(part, ic.pt(part, 'base'), sc=spring(0.40 + 0.035 * k, [0, 0], [100, 100], 1.7, 0.48))
pop(ic, 'Large_Sparkle', 0.50, spin=-100, frm=mouth, tw=1.95)
pop(ic, 'Left_Sparkle', 0.56, spin=80, frm=mouth)
pop(ic, 'Right_Sparkle', 0.60, spin=-80, frm=mouth, tw=2.35)
bits = ['Purple_Capsule_Left', 'Cyan_Capsule_Right', 'Cyan_Capsule_Left', 'Purple_Capsule_Right', 'Sphere_Left', 'Sphere_Right',
        'Sphere_Bottom']
for k, part in enumerate(burst_order(ic, bits, mouth)):
    spin = 0.0 if 'Sphere' in part else (150.0 if k % 2 else -150.0)
    pop(ic, part, 0.60 + 0.035 * k, spin=spin, f=1.8, zeta=0.45, frm=mouth)
pop(ic, 'Purple_Cross', 0.74, spin=90)
order = ['Purple_Cross', 'Canister_Front', 'Spray_Inner_Left', 'Spray_Inner_Right', 'Spray_Left', 'Spray_Right', 'Canister',
         'Large_Sparkle', 'Left_Sparkle', 'Right_Sparkle'] + bits
ICONS.append(ic.spec(order))

# ---------------------------------------------------------------- 2.3 Whose (people + add)
ic = Icon('Name', 'GR icon 2.3 Whose', 'whose')
ic.add('Rear_Person', ic.pt('Rear_Person', 'bottom'), **rise(0.10, dy=30.0, tilt=-5.0))
ic.add('Front_Person', ic.pt('Front_Person', 'bottom'), **rise(0.20, dy=34.0, tilt=5.0))
dc = ic.pt('Badge_Disc', 'c')
ic.add('Badge_Disc', dc, sc=(spring(0.55, [0, 0], [100, 100], 1.9, 0.42), bump(2.05, 10.0)))
ic.add('Plus', ic.pt('Plus', 'c'), sc=(spring(0.63, [0, 0], [100, 100], 1.9, 0.40), bump(2.08, 14.0)),
       rot=(spring(0.63, -90.0, 0.0, 1.4, 0.55), wave(2.08, [0.0, 90.0], 0.5, inf=60)))
ICONS.append(ic.spec())

# ---------------------------------------------------------------- Name your registry (tag + pen writes)
ic = Icon('Registry_Name', 'GR icon Name your registry', 'name-your-registry')
# The ring threads through the eyelet: full ring BEHIND the tag + its top half IN FRONT (gen/prep.py ring_front).
# Everything turns about the eyelet, so the threading holds; the ring only adds a small wobble of its own after the tag
# has settled.
hole = json.load(open(os.path.join(HERE, 'registry_hole.json')))['hole']
tag_sc = spring(0.10, [0, 0], [100, 100], 1.5, 0.45)
tag_rot = spring(0.10, -12.0, 0.0, 1.1, 0.4)
ic.add('Tag', hole, sc=tag_sc, rot=tag_rot)
t_wob = tag_rot[-1][0] + 0.05
ring_rot = (tag_rot, wave(t_wob, [0, -4.0, 2.5, -1.0, 0], 0.16))
ic.parts['Ring_Front'] = {**ic.parts['Ring'], 'name': 'Registry_Name_Ring_Front', 'file': 'art/Registry_Name_Ring_Front.png'}
ic.add('Ring', hole, sc=tag_sc, rot=ring_rot)
ic.add('Ring_Front', hole, sc=tag_sc, rot=ring_rot)
nib = ic.pt('Pen', 'base')
t_pen = 0.42
px = spring(t_pen, 80.0, 0.0, 1.35, 0.62); py = spring(t_pen, -80.0, 0.0, 1.35, 0.62)
t_w = max(px[-1][0], py[-1][0]) + 0.06
# writing: a few small strokes of the nib, then still
ic.add('Pen', nib, dx=(px, wave(t_w, [0, -9, 5, -6, 3, 0], 0.11)), dy=(py, wave(t_w, [0, 4, -3, 3, -1, 0], 0.11)),
       rot=spring(t_pen, 24.0, 0.0, 1.25, 0.5), op=fade(t_pen, 0.14))
pop(ic, 'Green_Sparkle', 0.55, spin=-100, tw=2.0)
pop(ic, 'Silver_Sparkle', 0.66, spin=90, tw=2.4)
pop(ic, 'Iridescent_Cross', 0.74, spin=90)
ICONS.append(ic.spec(['Pen', 'Iridescent_Cross', 'Ring_Front', 'Tag', 'Ring', 'Green_Sparkle', 'Silver_Sparkle']))

# ---------------------------------------------------------------- 1.3 When (calendar + hanging tag swings)
ic = Icon('Date', 'GR icon 1.3 When', 'when')
calendar(ic)
hook = ic.pt('Connector_Ring', 'c')
ic.add('Connector_Ring', hook, sc=spring(0.52, [0, 0], [100, 100], 1.9, 0.42))
ic.add('Hanging_Tag', hook, sc=spring(0.56, [0, 0], [100, 100], 1.8, 0.45),
       rot=spring(0.56, 34.0, 0.0, 1.0, 0.3, settle=0.01))
pop(ic, 'Iridescent_Cross', 0.72, spin=90)
ICONS.append(ic.spec(['Iridescent_Cross', 'Hanging_Tag', 'Connector_Ring', 'Ring_Left_Front', 'Ring_Right_Front', 'Calendar',
                      'Ring_Left', 'Ring_Right']))

# ---------------------------------------------------------------- 2.5 Due date (calendar + balloon floats up)
ic = Icon('Due_Date', 'GR icon 2.5 Due date', 'due-date')
calendar(ic)
pop(ic, 'Page_Sparkle', 0.56, spin=-90)
knot = ic.pt('Balloon_String', 'base')
ic.add('Balloon_String', knot, dy=(spring(0.44, 90.0, 0.0, 0.85, 0.55), wave(2.0, [0, -7, 0], 0.5)),
       sc=spring(0.44, [60, 60], [100, 100], 1.2, 0.5), op=fade(0.44, 0.16),
       rot=spring(0.44, -12.0, 0.0, 0.8, 0.32, settle=0.01))
pop(ic, 'Large_Sparkle', 0.62, spin=-100, tw=2.0)
pop(ic, 'Small_Sparkle', 0.70, spin=90)
pop(ic, 'Iridescent_Cross', 0.76, spin=90)
ICONS.append(ic.spec(['Iridescent_Cross', 'Page_Sparkle', 'Ring_Left_Front', 'Ring_Right_Front', 'Calendar', 'Ring_Left', 'Ring_Right',
                      'Balloon_String', 'Large_Sparkle', 'Small_Sparkle']))

# ---------------------------------------------------------------- 1.4 Delivery (map unfolds, pin drops, flag waves)
ic = Icon('Address', 'GR icon 1.4 Delivery', 'delivery')
ic.add('Map', ic.pt('Map', 'bottom'), sc=spring(0.10, [40, 0], [100, 100], 1.5, 0.5), dy=spring(0.10, 20.0, 0.0, 1.3, 0.62))
ic.add('Pin', ic.pt('Pin', 'base'), **drop(0.30, dy=-150.0, f=1.5, zeta=0.42))
pole = ic.pt('Flag', 'base')
ic.add('Flag', pole, sc=spring(0.62, [100, 0], [100, 100], 1.8, 0.42),
       rot=spring(0.62, -18.0, 0.0, 1.15, 0.33, settle=0.01))
pop(ic, 'Green_Sparkle', 0.70, spin=-100, tw=2.3)
pop(ic, 'Silver_Sparkle', 0.80, spin=90)
# the flagpole stands in the map: flag behind the map (stacking check: the reference shows the map over the pole)
ICONS.append(ic.spec(['Pin', 'Map', 'Flag', 'Green_Sparkle', 'Silver_Sparkle']))


# ---------------------------------------------------------------- emit
def main():
    data = {'dur': DUR, 'fps': FPS, 'rot0': ROT0, 'root': ROOT, 'icons': ICONS}
    json.dump(data, open(os.path.join(HERE, 'icons.json'), 'w'), indent=1)
    tpl = open(os.path.join(HERE, 'icons_tpl.jsx')).read()
    open(os.path.join(BUILD, 'build_icons.jsx'), 'w').write(tpl.replace('/*DATA*/null', json.dumps(data)))
    for i in ICONS:
        print(i['comp'], len(i['layers']), 'layers')


if __name__ == '__main__':
    main()
