#!/usr/bin/env python3
"""Writes the PROJECT CONFIG block of icons/proto/spec/index.html from proto/motion.json (built from gen/icons.json, the
same keys as the AE comps and the lotties). Rerun after gen/motion.py + gen/build_proto.py."""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
P = os.path.join(ROOT, 'proto'); PAGE = os.path.join(P, 'spec', 'index.html')
M = json.load(open(os.path.join(P, 'motion.json')))

SCREENS = {  # slug: (scene name, where it plays)
    'occasion': ('1.1 Occasion', 'Occasion step opens'),
    'whose': ('2.3 Whose', 'Whose-is-it step opens'),
    'name-your-registry': ('Name your registry', 'Name step opens'),
    'when': ('1.3 When', 'Date step opens'),
    'due-date': ('2.5 Due date', 'Due-date step opens (Baby shower only)'),
    'delivery': ('1.4 Delivery', 'Delivery step opens'),
}
NAMES = {  # layer name -> designer-facing label
    'canister': 'Canister', 'canister front': 'Canister · front lip', 'spray inner left': 'Spray · inner left',
    'spray inner right': 'Spray · inner right', 'spray left': 'Spray · left', 'spray right': 'Spray · right',
    'large sparkle': 'Large star', 'left sparkle': 'Left star', 'right sparkle': 'Right star',
    'purple capsule left': 'Capsule · purple left', 'cyan capsule right': 'Capsule · cyan right',
    'cyan capsule left': 'Capsule · cyan left', 'purple capsule right': 'Capsule · purple right',
    'sphere left': 'Ball · left', 'sphere right': 'Ball · right', 'sphere bottom': 'Ball · bottom', 'purple cross': 'Cross',
    'rear person': 'Person · back', 'front person': 'Person · front', 'badge disc': 'Add badge', 'plus': 'Plus',
    'tag': 'Tag', 'ring': 'Key ring · back half', 'ring front': 'Key ring · front half', 'pen': 'Pen',
    'green sparkle': 'Green star', 'silver sparkle': 'Silver star', 'iridescent cross': 'Cross',
    'calendar': 'Calendar', 'ring left': 'Binder ring left · back', 'ring right': 'Binder ring right · back',
    'ring left front': 'Binder ring left · front', 'ring right front': 'Binder ring right · front',
    'connector ring': 'Connector ring', 'hanging tag': 'Hanging tag', 'page sparkle': 'Page star',
    'balloon string': 'Balloon', 'small sparkle': 'Small star', 'map': 'Map', 'pin': 'Pin', 'flag': 'Flag',
}
NOTES = {
    ('occasion', 'canister'): 'The popper springs up from its base with a small tilt; the canister and its front lip share one pivot and one set of keys.',
    ('occasion', 'canister front'): 'The front lip of the canister, cut from the same art: the sprays sit between it and the canister, so they rise out of the mouth.',
    ('occasion', 'spray inner left'): 'Each spray grows from its stem end, hidden inside the canister, 35ms after the previous one.',
    ('occasion', 'large sparkle'): 'Flies out of the canister mouth to its place while it pops and spins; twinkles once at rest.',
    ('occasion', 'purple capsule left'): 'Confetti bursts from the mouth, nearest piece first, 35ms apart; capsules spin, balls do not.',
    ('whose', 'badge disc'): 'The add badge pops after both people have landed; badge and plus pulse together once at rest.',
    ('whose', 'plus'): 'Spins a quarter turn in as it pops; the second quarter turn rides the rest pulse.',
    ('name-your-registry', 'tag'): 'Swings in about the eyelet. The key ring is split: back half behind the tag, front half over the eyelet rim, both on the tag\'s pivot and keys.',
    ('name-your-registry', 'ring'): 'Rides with the tag, then wobbles a few degrees about the eyelet on its own.',
    ('name-your-registry', 'pen'): 'Slides in from the top right on its nib, then makes five small writing strokes and stops.',
    ('when', 'calendar'): 'Springs up from its base. The binder rings ride on the calendar\'s pivot and keys: front strand drops into the dark punch hole, back strand passes behind the top edge.',
    ('when', 'hanging tag'): 'Swings on the connector ring like a pendulum and settles.',
    ('due-date', 'calendar'): 'Springs up from its base, binder rings riding with it (front strand into the hole, back strand behind the top edge).',
    ('due-date', 'balloon string'): 'Floats up from behind the calendar on a slow spring, sways about the string end and bobs once.',
    ('delivery', 'map'): 'Unfolds from its bottom edge: grows wider and taller on one spring.',
    ('delivery', 'pin'): 'Drops in from above onto the map with a bounce.',
    ('delivery', 'flag'): 'Springs up from the pole base (behind the map) with a wave that settles.',
}

data = {'icons': [{'slug': ic['slug'], 'name': SCREENS[ic['slug']][0], 'trig': SCREENS[ic['slug']][1],
                   'layers': [{'n': L['name'], 'label': NAMES.get(L['name'], L['name'].title()), 'doc': L['doc'], 'tracks': L['tracks'],
                               'note': NOTES.get((ic['slug'], L['name']))} for L in ic['layers']]} for ic in M['icons']]}
lots = sorted(f for f in os.listdir(os.path.join(P, 'assets', 'lottie')) if f.endswith('.lottie'))
SLUG_OF = lambda f: f.replace('gr-icon-', '').replace('.lottie', '').replace('1-1-', '').replace('2-3-', '').replace('1-3-', '').replace('2-5-', '').replace('1-4-', '')
assets = [{'name': 'Icon · ' + SCREENS[SLUG_OF(f)][0], 'file': '/assets/lottie/' + f, 'download': f,
           'preview': '/assets/lottie/' + f.replace('.lottie', '.json')} for f in lots]

CONFIG = r'''<script id="spec-config">
/* ═══ PROJECT CONFIG — Gift Registry icon lotties (generated by icons/gen/spec_config.py; edit that, not this) ═══
   Rows come from the same keys as the AE comps and the exported lotties (icons/gen/motion.py). Springs are keyed in
   AE at each extreme of a damped spring (36% bezier influence), which the lottie plays as keyframes. Distances are px
   in the 600 x 600 lottie comp. */
window.SPEC = (() => {
  const { S, C, sceneEnd, wait: realWait } = SpecKit;
  const DATA = __DATA__;
  const DUR = __DUR__;
  const PATHS = { 1: '/' };
  const ITER = { 1: 'Iteration 01 · 18 Nov asset pack: six chrome icons, every part moves on its own' };

  // springs: one entry per (frequency, damping) the motion uses
  const SPR = {};
  const sk = (m) => `f${m.f}z${m.zeta}`;
  for (const ic of DATA.icons) for (const L of ic.layers) for (const runs of Object.values(L.doc)) for (const m of runs)
    if (m.kind === 'spring' && !SPR[sk(m)]) SPR[sk(m)] = { name: `Spring ${m.f} Hz · ζ ${m.zeta}`, w: m.w, z: m.zeta, src: 'icons/gen/motion.py · spring(), keyed at each extreme' };
  const CURVE = {
    out: { name: 'Ease-out', fn: 'linear(0, 0.2363, 0.3453, 0.4424, 0.5291, 0.607, 0.6754, 0.7351, 0.7873, 0.8322, 0.8702, 0.9019, 0.9278, 0.9489, 0.9654, 0.9779, 0.9871, 0.9933, 0.9971, 0.9991, 1)' },
    io:  { name: 'Ease-in-out', fn: 'linear(0, 0.009, 0.0207, 0.0384, 0.0644, 0.1004, 0.1507, 0.2205, 0.3141, 0.4332, 0.5641, 0.6834, 0.7786, 0.8477, 0.8976, 0.9344, 0.9605, 0.9789, 0.9908, 0.9976, 1)' },
    lin: { name: 'Linear', fn: 'linear(0, 1)' },
  };

  // value of a keyed track at t (s): AE zero-speed beziers, cubic-bezier(out/100, 0, 1 - in/100, 1) per segment
  function bez(x1, x2, x) {
    let lo = 0, hi = 1, u = x;
    for (let i = 0; i < 30; i++) { u = (lo + hi) / 2; const bx = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u; if (bx < x) lo = u; else hi = u; }
    return 3 * (1 - u) * u * u + u * u * u;
  }
  function at(keys, t, ch) {
    const val = (k) => (Array.isArray(k[1]) ? k[1][ch] : k[1]);
    if (t <= keys[0][0]) return val(keys[0]);
    for (let i = 0; i + 1 < keys.length; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t <= b[0]) { const x = (t - a[0]) / (b[0] - a[0]); return val(a) + (val(b) - val(a)) * bez(a[3] / 100, 1 - b[2] / 100, x); }
    }
    return val(keys[keys.length - 1]);
  }
  const PROP = { sc: ['scale', 'Scale', '%'], dx: ['move', 'Move X', 'px'], dy: ['move', 'Move Y', 'px'], rot: ['move', 'Rotation', '°'], op: ['opacity', 'Opacity', '%'] };
  const KIND = { wave: 'Sway', twinkle: 'Twinkle', bump: 'Pulse', fade: 'Fade in', keys: 'Keyframes' };
  const fmt = (v, u) => `${Math.round(v * 100) / 100}${u === '°' ? 'deg' : u}`;
  const ms = (s) => Math.round(s * 1000);

  function layerRows(icon, L) {
    const sel = `[data-part="${L.n}"]`, rows = [];
    for (const k of ['sc', 'dx', 'dy', 'rot', 'op']) {
      if (!L.doc[k]) continue;
      const [ico, prop, unit] = PROP[k];
      for (const m of L.doc[k]) {
        if (!m.t0 && m.t0 !== 0) continue;
        const delay = ms(m.t0), dur = ms(m.end - m.t0);
        const chans = k === 'sc' && Array.isArray(m.v0 ?? m.vals) ? null : null;
        const split = k === 'sc' && m.kind === 'spring' && m.v0[0] !== m.v0[1];
        const names = k === 'sc' ? (split ? ['Scale X', 'Scale Y'] : ['Scale']) : [prop];
        names.forEach((pn, ch) => {
          let from, to, ease;
          if (m.kind === 'spring') {
            const v0 = Array.isArray(m.v0) ? m.v0[ch] : m.v0, v1 = Array.isArray(m.v1) ? m.v1[ch] : m.v1;
            from = fmt(v0, unit); to = fmt(v1, unit); ease = S(sk(m));
          } else {
            const keys = L.tracks[k], t0 = m.t0, span = m.end - m.t0;
            const thru = keys.filter((q) => q[0] >= t0 - 1e-6 && q[0] <= m.end + 1e-6).map((q) => fmt(Array.isArray(q[1]) ? q[1][ch] : q[1], unit));
            from = thru[0]; to = thru[thru.length - 1];
            ease = { kind: 'custom', label: KIND[m.kind] || m.kind, tag: KIND[m.kind] || m.kind,
                     info: [['Keys', thru.join(' → ')], ['Curve', 'AE bezier, zero speed at every key']],
                     plot: { f: (t) => at(keys, t0 + t, ch), span } };
          }
          rows.push({ icon: ico, prop: pn, layer: L.label, sel, delay, dur, from, to, ease });
        });
      }
    }
    return rows;
  }
  function iconRows(icon) {
    const groups = icon.layers.map((L) => ({ L, rows: layerRows(icon, L) })).filter((g) => g.rows.length);
    groups.sort((a, b) => Math.min(...a.rows.map((r) => r.delay)) - Math.min(...b.rows.map((r) => r.delay)));
    const out = [];
    for (const g of groups) {
      const t = Math.min(...g.rows.map((r) => r.delay));
      out.push({ grp: g.L.label, at: t, note: g.L.note || undefined });
      out.push(...g.rows);
    }
    return out;
  }

  const SCENES = [{ id: 0, name: 'Overview', trig: 'all six icons, one after another', summary: DATA.icons.map((i) => i.name).join(' → '), overview: true }];
  DATA.icons.forEach((ic, i) => SCENES.push({ id: i + 1, name: ic.name, trig: `${ic.trig} · plays once (${DUR}s lottie)`, rows: () => iconRows(ic) }));

  function overview(v) {
    const ids = SCENES.filter((s) => !s.overview).map((s) => s.id), at0 = {}; let t = 0;
    for (const id of ids) { at0[id] = t; t += sceneEnd(SCENES[id].rows(v)) + 700; }
    const rows = ids.map((id) => ({ icon: 'flag', prop: `${id}`, layer: SCENES[id].name, sel: null, delay: at0[id], dur: sceneEnd(SCENES[id].rows(v)), scene: id, from: '', to: '', ease: { kind: 'scene' }, note: `${SCENES[id].trig}.` }));
    const beats = ids.map((id) => ({ at: at0[id], fire: (d, w) => FIRE[id](d, w) }));
    return { rows, beats };
  }

  const ST = {
    async ready(d, w, e) {
      for (let i = 0; i < 100; i++) { if (w.proto && w.proto.ready()) break; await realWait(100); }
      await realWait(150);
      await e.advanceTo(e.vt + 100, 48);
    },
  };
  const PREP = { 0: 'ready' }, FIRE = {};
  DATA.icons.forEach((ic, i) => { PREP[i + 1] = 'ready'; FIRE[i + 1] = (d, w) => w.proto.play(ic.slug); });

  return {
    title: 'Gift Registry icons — Animation Spec', device: { w: 360, h: 360, label: 'Lottie 600×600 · shown at 360' },
    paths: PATHS, iterations: ITER, springs: SPR, curves: CURVE, scenes: SCENES, overview, states: ST, prep: PREP, fire: FIRE,
    assets: __ASSETS__,
    lottieLib: '/vendor/lottie_light.min.js',
  };
})();
</script>'''

block = CONFIG.replace('__DATA__', json.dumps(data, separators=(',', ':'))).replace('__DUR__', json.dumps(M['dur'])) \
              .replace('__ASSETS__', json.dumps(assets))
html = open(PAGE).read()
html2, n = re.subn(r'<script id="spec-config">.*?</script>', lambda _: block, html, count=1, flags=re.S)
assert n == 1
open(PAGE, 'w').write(html2)
print('config written:', len(data['icons']), 'icons,', len(assets), 'lottie assets')
