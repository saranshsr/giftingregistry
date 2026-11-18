#!/usr/bin/env python3
"""Occasion hero sets -> ../build/occ_<occasion>.jsx (one ExtendScript per occasion, same builder + motion as the page heroes).
AE: 01 Hero lotties (export these)/Occasion sets/<NN Label>/<comp>; shared pictures in '_shared art (used by every occasion)'."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
HER = os.path.join(os.path.dirname(ROOT), 'heroes')
sys.path.insert(0, os.path.join(HER, 'gen')); sys.path.insert(0, HERE)
import gen_heroes as gh

ORDER = ['default', 'eid', 'birthday', 'babyshower', 'wedding', 'housewarming', 'anniversary', 'other']
LABEL = {'default': 'Default', 'eid': 'Eid', 'birthday': 'Birthday', 'babyshower': 'Baby shower', 'wedding': 'Wedding',
         'housewarming': 'House warming', 'anniversary': 'Anniversary', 'other': 'Other'}
SCREEN = {'p5': '1.1 Occasion', 'p3': '2.3 Whose is it', 'p6': 'Name your registry', 'p1': '1.3 When is it',
          'p4': '2.5 Due date', 'p2': '1.4 Delivery details'}
PG_ORDER = ['p5', 'p3', 'p6', 'p1', 'p4', 'p2']
BUILD = os.path.join(ROOT, 'build'); os.makedirs(BUILD, exist_ok=True)
tpl = open(os.path.join(HER, 'gen', 'hero_tpl.jsx')).read()
only = sys.argv[1:]
for i, occ in enumerate(ORDER):
    if only and occ not in only: continue
    specs = []
    for pg in PG_ORDER:
        f = os.path.join(ROOT, 'art', occ, pg, 'hero.json')
        if not os.path.exists(f): continue
        H = json.load(open(f))
        specs.append(gh.page_spec(pg, H, 'GR hero %s - %s' % (SCREEN[pg], LABEL[occ]), ['Occasion sets', '%02d %s' % (i, LABEL[occ])]))
    S = {'pages': specs, 'dur': 3.4, 'fps': 60, 'root': '01 Hero lotties (export these)', 'log': os.path.join(BUILD, 'occ_%s.log' % occ)}
    out = os.path.join(BUILD, 'occ_%s.jsx' % occ)
    open(out, 'w').write(tpl.replace('/*SPEC*/null', json.dumps(S, ensure_ascii=True)))
    print('%-13s %d comps  %s  %.0f KB' % (occ, len(specs), ', '.join(s['name'].split(' - ')[0][8:] for s in specs), os.path.getsize(out) / 1024))
