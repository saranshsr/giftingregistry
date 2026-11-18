import { AnimatePresence, motion, useAnimate, type Variants } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DashedDivider, OriginIcon, Pressable, Screen, TextField } from '../../components';
import { useNav } from '../../kit/Navigator';
import type { ScreenProps } from '../../kit/types';
import { useReduceMotion } from '../../motion/reducedMotion';
import { art, heroLottie, registryBackdrop, warmLottie } from './assets';
import { HeroLottie, useRecolourQueue } from './components/HeroLottie';
import { NanoButton, nanoColors } from './components/NanoButton';
import { useIosDatePicker } from './components/IosDatePicker';
import { decodeSoon } from './warm';
import { haptics, prepareHaptics } from './haptics';
import { LeaveAtDoorCard } from './components/sheets/LeaveAtDoorCard';
import { OccasionTile } from './components/OccasionTile';
import { ThemedBackground } from './components/ThemedBackground';
import { addresses, copy, defaultName, flowSteps, occasionOf, occasions, registryName, steps, type StepId } from './data';
import { arrive, fade, fadeOut, MOVE, move, STAGGER_IN } from './motion';
import { grStore } from './store';
import { themeOf } from './theme';
import styles from './steps.module.css';

/**
 * 04 The registry steps (Figma 843:719902 "Updated Visuals"), one modal screen whose steps swap inside it:
 * 1.1 Occasion → 2.3 Whose <occasion> is it? → Name your registry → 1.3 When is it? (2.5 Due date for Baby shower)
 * → 1.4 Delivery details → Create. Every step plays its hero lottie over the occasion's page; picking an occasion on
 * 1.1 recolours the page and the ribbon at once (same frame, 450 ms cross-fade).
 *
 * Between steps the body leaves 28 pt against the direction and arrives from 28 pt with it, 140 ms after the hero
 * starts, 60 ms apart, on the MOVE spring. Arriving from the explainer (`morph`), the hero is already growing in with
 * the card; back / progress, body and footer land after it (reference playMorphLanding).
 */
const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
const TILE_SLOTS: [number, number][] = [
  [0.5, 0],
  [110.5, 0],
  [220.5, 0],
  [0.5, 132],
  [110.5, 132],
  [220.5, 132],
  [55.5, 264],
  [165.5, 264],
];
/** footer resting offset: the CTA sits above the home indicator; 0 = riding a keyboard */
const FOOTER_REST = 272;
/** reference onPad: date top = round((243 + cta) / 2 − 46), cta 451 with the pad up / 724 without; chip 56 below */
const DATE_TOP = 301;
const DATE_DROP = 137;

export function StepsScreen({ params }: ScreenProps<{ morph?: string; step?: StepId }>) {
  const nav = useNav();
  const reduce = useReduceMotion();
  const s = grStore.useStore();
  const [cur, setCur] = useState<StepId>(params.step && steps[params.step] ? params.step : 'occ');
  const [dir, setDir] = useState(0);
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const morph = params.morph === '1';
  // first arrival: after the card has grown (morph) or the modal has risen
  const entry = useRef(morph ? 0.42 : 0.3);
  const firstStep = useRef(true);
  useEffect(() => {
    firstStep.current = false;
    entry.current = 0;
  }, [cur]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => (prepareHaptics(), nav.preload('giftregistry/address', 'giftregistry/registry')), []);

  // recolour queue (HeroLottie.tsx): on 1.1 the hero, page wash and CTA play one recolour at a time and then jump to
  // the latest pick; the tiles (s.occ) answer every pick at once
  const queuedOcc = useRecolourQueue(s.occ);
  const shownOcc = cur === 'occ' ? queuedOcc : s.occ;
  const theme = themeOf(shownOcc);
  const order = flowSteps(s.occ);
  const st = steps[cur];
  // the date steps' number pad behaves like a keyboard (reference r3Numpad): it rises when the field is focused, a tap
  // anywhere else puts it away, "Pick from calendar" puts it away before the picker rises
  const [padOpen, setPadOpen] = useState(false);
  const isDate = cur === 'when' || cur === 'due';
  useEffect(() => {
    if (!isDate) return setPadOpen(false);
    const t = setTimeout(() => setPadOpen(true), (entry.current + 0.12) * 1000);
    return () => clearTimeout(t);
  }, [cur, isDate]);
  const kb: 'none' | 'text' | 'num' = st.kb === 'num' ? (padOpen ? 'num' : 'none') : st.kb === 'text' && focused && !TOUCH ? 'text' : 'none';

  // ---- validation ----
  const dateOk = useMemo(() => dateValid(s.digits), [s.digits]);
  const problem = (): string => {
    switch (cur) {
      case 'occ':
        return s.occ ? '' : copy.steps.errors.occ;
      case 'whose':
        return s.name.trim() ? '' : copy.steps.errors.whose;
      case 'name':
        return s.regName.trim() ? '' : copy.steps.errors.name;
      case 'when':
      case 'due':
        return dateOk ? '' : s.digits.length === 8 ? copy.steps.errors.invalid : cur === 'due' ? copy.steps.errors.due : copy.steps.errors.date;
      default:
        return '';
    }
  };
  const ok = !problem();
  const picker = useIosDatePicker({
    value: dateOk ? new Date(+s.digits.slice(4), +s.digits.slice(2, 4) - 1, +s.digits.slice(0, 2)) : null,
    tint: theme.accent,
    onPick: (d) => (
      haptics.selectionTick(),
      grStore.patch({ digits: String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0') + d.getFullYear(), dateConfirmedAt: Date.now() })
    ),
  });
  useEffect(() => setInvalid(false), [cur, s.name, s.regName, s.digits]);

  // ---- navigation between steps ----
  const go = useCallback((to: StepId, d: number) => {
    if (to === 'name') {
      const g = grStore.get();
      if (!g.regEdited && g.occ) grStore.patch({ regName: registryName(g.name || defaultName, occasionOf(g.occ)) });
    }
    setDir(d);
    setCur(to);
  }, []);
  // the last step change the user made with a tap (the hero's landing cue only answers those, never an auto-advance)
  const userStepAt = useRef(-1);
  const back = () => {
    haptics.lightTap();
    const i = order.indexOf(cur);
    // back from the first step closes the flow: it drops away and uncovers My Lists (the sheets are long gone)
    if (i <= 0) return nav.back();
    userStepAt.current = performance.now();
    go(order[i - 1], -1);
  };
  const close = () => (haptics.lightTap(), nav.back());

  // a date picked in the system picker (or the desktop stand-in) lands in the field and stays there: no auto-advance.
  // The user reads it and taps Continue, which is the confirmation; Continue wakes with NanoButton's enable bump.
  // `pickedAt` keys the field's arrival animation (picks only; typed digits don't animate), reset on a step change.
  const [pickedAt, setPickedAt] = useState(0);
  const confirmedAt = s.dateConfirmedAt;
  const seen = useRef(confirmedAt);
  useEffect(() => {
    if (confirmedAt == null || confirmedAt === seen.current) return;
    seen.current = confirmedAt;
    setPickedAt(confirmedAt);
  }, [confirmedAt]);
  useEffect(() => setPickedAt(0), [cur]);


  // Create: the step's content, top bar and CTA fade out in place over the themed background, which the registry page
  // then fades in over
  const [leaving, setLeaving] = useState(false);
  const [ctaScope, animateCta] = useAnimate();
  const onCta = () => {
    const msg = problem();
    if (msg) {
      haptics.failure();
      setInvalid(true);
      if (!reduce) animateCta(ctaScope.current, { x: [0, -6, 5, -3, 0] }, { duration: 0.32, ease: 'easeOut' });
      nav.toast(msg);
      return;
    }
    const i = order.indexOf(cur);
    // press / release are NanoButton's own (touch-down / touch-up); Enter plays none, like a hardware key
    if (i === order.length - 1) return create();
    userStepAt.current = performance.now();
    go(order[i + 1], 1);
  };
  const create = async () => {
    if (leaving) return;
    setLeaving(true);
    const g = grStore.get();
    // the registry page's backdrop decoded first (capped at 300 ms, overlapping the 150 ms fade), so it never paints
    // half-loaded during the hand-off
    await Promise.all([decodeSoon([registryBackdrop(themeOf(g.occ).family)]), new Promise((r) => setTimeout(r, reduce ? 0 : 150))]);
    const id = Date.now();
    grStore.patch({ created: [{ id, name: g.regName.trim(), occasion: g.occ!, date: g.digits }, ...g.created] });
    // the registry page takes over from the steps (`from: create` = it fades in over this themed background); My Lists
    // (below) gets its new card when the page is left
    nav.replace('giftregistry/registry', { id: String(id), from: 'create' }, { presentation: 'screen', transition: 'gr-reveal' });
  };

  // keys: Enter = CTA, Escape = back, digits on the date steps
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      onCta();
      return;
    }
    if (e.key === 'Escape') {
      back();
      return;
    }
    if (cur === 'when' || cur === 'due') {
      if (/^[0-9]$/.test(e.key)) {
        setPadOpen(true);
        typeDigit(e.key);
        e.preventDefault();
      } else if (e.key === 'Backspace') {
        typeDigit('del');
        e.preventDefault();
      }
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const typeDigit = (k: string) => {
    const d = grStore.get().digits;
    grStore.patch({ digits: k === 'del' ? d.slice(0, -1) : d.length < 8 ? d + k : d });
  };

  const pickOccasion = (k: (typeof occasions)[number]['key']) => {
    const g = grStore.get();
    haptics.selectionTick();
    grStore.patch(g.occ !== k ? { occ: k, digits: '', regEdited: false } : { occ: k });
    warmLottie(...flowSteps(k).map((id) => heroLottie(id, k)));
  };

  // ---- choreography ----
  const base = entry.current;
  // the body as a whole only leaves (against the direction); its parts arrive one by one, with the direction
  const bodyVariants: Variants = {
    enter: { opacity: 1 },
    shown: { opacity: 1 },
    exit: (d: number) => (reduce ? { opacity: 0, transition: fadeOut(0.15) } : { opacity: 0, x: -28 * d, transition: { ...MOVE, opacity: fadeOut(0.2) } }),
  };
  const lead = base + (dir ? 0.14 : 0.08);
  const from = reduce ? { opacity: 0 } : { opacity: 0, x: dir ? 28 * dir : 0, y: dir ? 0 : 16 };
  const part = (i: number, node: ReactNode, style: CSSProperties, key?: string) => (
    <motion.div key={key ?? i} className={styles.part} style={style} variants={{ enter: from, shown: { opacity: 1, x: 0, y: 0, transition: arrive(lead + i * STAGGER_IN, 0.3) } }}>
      {node}
    </motion.div>
  );

  const vars = { '--accent': theme.accent, '--tint-a': theme.tintA, '--tint-b': theme.tintB } as CSSProperties;
  const heroDelay = firstStep.current ? 0 : 0.2;
  // nano frame cue: every step hero's illustration rig lands on frame 21 (lottie_cues.py, 60 fps); a light tick there,
  // only after a step the user moved with a tap in the last second (never an auto-advance or the first landing)
  const heroCue = useMemo(() => ({ frame: 21, ok: () => performance.now() - userStepAt.current < 1000 }), []);

  return (
    <Screen
      background="bgSurface"
      safeTop={false}
      contentStyle={{ overflow: 'hidden', padding: 0 }}
      overlay={
        <Footer kb={kb} landing={firstStep.current ? base + 0.12 : null} leaving={leaving} reduce={reduce} onDigit={typeDigit} style={vars}>
          <motion.div ref={ctaScope}>
            {/* nano Button v3: plays press / release itself; a tap while disabled runs onCta for the shake + failure */}
            <NanoButton variant="primary" colors={nanoColors(theme)} disabled={!ok} onDisabledClick={onCta} onClick={onCta} className={styles.ctaNano}>
              {st.cta ?? copy.steps.continue}
            </NanoButton>
          </motion.div>
        </Footer>
      }
    >
      <div
        className={styles.stage}
        style={vars}
        onPointerDownCapture={(e) => {
          if (padOpen && !(e.target as HTMLElement).closest('[data-datefield], [data-chip]')) setPadOpen(false);
        }}
      >
        <ThemedBackground theme={theme} />
        {isDate && picker.node}
        <motion.div className={styles.frame} initial={false} animate={{ opacity: leaving ? 0 : 1 }} transition={fade(0.15)}>
          <HeroLottie src={heroLottie(cur, shownOcc)} playKey={cur} delay={heroDelay} cue={heroCue} />

          <AnimatePresence mode="wait" custom={dir} initial>
            <motion.div key={cur} className={styles.body} custom={dir} variants={bodyVariants} initial="enter" animate="shown" exit="exit">
              {cur === 'occ' &&
                occasions.map((o, i) =>
                  part(
                    i,
                    <OccasionTile occasion={o} selected={s.occ === o.key} onSelect={() => pickOccasion(o.key)} style={{ position: 'relative' }} />,
                    { left: 28 + TILE_SLOTS[i][0], top: 302 + TILE_SLOTS[i][1], width: 98, height: 120 },
                    o.key,
                  ),
                )}
              {(cur === 'whose' || cur === 'name') &&
                part(
                  0,
                  <BigField
                    key={cur}
                    value={cur === 'whose' ? s.name : s.regName}
                    placeholder={cur === 'whose' ? copy.steps.namePlaceholder : copy.steps.registryPlaceholder}
                    error={invalid}
                    autoFocusDelay={(base + 0.12) * 1000}
                    onFocus={setFocused}
                    onChange={(v) => grStore.patch(cur === 'whose' ? { name: v, regEdited: false } : { regName: v, regEdited: true })}
                  />,
                  { left: 32, top: cur === 'whose' ? 333 : 318, width: 311, height: 40 },
                )}
              {isDate && [
                part(
                  0,
                  // the date and its chip sit halfway between the title and the CTA: higher with the pad up (reference onPad)
                  <motion.div data-datefield initial={false} animate={{ y: padOpen ? 0 : DATE_DROP }} transition={MOVE} onClick={() => setPadOpen(true)}>
                    <DateText digits={s.digits} bad={(s.digits.length === 8 && !dateOk) || (invalid && !dateOk)} active={padOpen} pickedAt={pickedAt} reduce={reduce} />
                  </motion.div>,
                  { left: 32, top: DATE_TOP, width: 311, height: 40 },
                  'date',
                ),
                part(
                  1,
                  <motion.span data-chip initial={false} animate={{ y: padOpen ? 0 : DATE_DROP }} transition={MOVE}>
                    {/* Figma 843:723079: tint gradient, r10, 8/10 padding, 20 pt calendar-filled, B14 SemiBold in the accent */}
                    <Pressable
                      className={styles.chip}
                      scale={0.96}
                      onClick={(e) => {
                        // the pad goes away, then the system date picker opens (native on iPhone, an iOS stand-in on desktop)
                        haptics.tap();
                        setPadOpen(false);
                        picker.open(e.currentTarget);
                      }}
                    >
                      <OriginIcon name="calendar-filled" size={20} color="var(--accent)" />
                      {copy.steps.pickFromCalendar}
                    </Pressable>
                  </motion.span>,
                  { left: 0, top: DATE_TOP + 56, width: 375, display: 'flex', justifyContent: 'center' },
                  'chip',
                ),
              ]}
              {cur === 'deliv' && [
                part(
                  0,
                  <AddressCard name={s.name.trim() || defaultName} addressKey={s.address} onEdit={() => (haptics.lightTap(), nav.sheet('giftregistry/address'))} />,
                  { left: 16, top: 270, width: 343 },
                  'addr',
                ),
                part(
                  1,
                  <div className={styles.note}>
                    <span className={styles.noteTip} />
                    <div className={styles.noteBox}>
                      <b>{copy.steps.note.bold}</b>
                      {copy.steps.note.rest}
                    </div>
                  </div>,
                  { left: 16, top: 398, width: 343 },
                  'note',
                ),
                part(2, <div className={styles.instrHead}>{copy.steps.instructions}</div>, { left: 16, top: 470, width: 343 }, 'head'),
                part(
                  3,
                  <LeaveAtDoorCard checked={s.leaveAtDoor} onChange={(v) => (haptics.lightTap(), grStore.patch({ leaveAtDoor: v }))} label={copy.steps.leaveAtDoor} />,
                  { left: 16, top: 500, width: 343 },
                  'leave',
                ),
              ]}
            </motion.div>
          </AnimatePresence>

          <TopBar isName={cur === 'name'} progress={st.progress} landing={firstStep.current && morph ? base : null} reduce={reduce} onBack={back} onClose={close} />
        </motion.div>
      </div>
    </Screen>
  );
}

/* ---------------------------------------------------------------------------------------------------------------- */

function TopBar({
  isName,
  progress,
  landing,
  reduce,
  onBack,
  onClose,
}: {
  isName: boolean;
  progress: number;
  landing: number | null;
  reduce: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  const pop = (i: number) =>
    landing != null && !reduce ? { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 }, transition: arrive(landing + 0.06 + i * 0.06, 0.24) } : {};
  return (
    <div className={styles.topbar}>
      <motion.div className={styles.back} {...pop(0)}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={isName ? 'x' : 'back'}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ ...MOVE, opacity: fade(0.16) }}
          >
            {/* Figma "Back button" (843:769416): 40 circle, white, 1 pt border/primary, 20 pt Origin chevron-left-bold / cross */}
            <Pressable className={styles.navBtn} onClick={isName ? onClose : onBack} aria-label={isName ? 'Close' : 'Back'}>
              <OriginIcon name={isName ? 'cross' : 'chevron-left-bold'} size={20} color="var(--nk-color-text-primary)" />
            </Pressable>
          </motion.div>
        </AnimatePresence>
      </motion.div>
      <motion.div className={styles.progress} {...pop(1)}>
        <motion.div className={styles.progressFill} initial={{ width: landing != null ? 0 : progress }} animate={{ width: progress }} transition={move(0.08)} />
      </motion.div>
    </div>
  );
}

/** action bar (kit Button) with the keyboard under it; the bar rides up with a keyboard and rests above the home indicator */
function Footer({
  kb,
  landing,
  leaving,
  reduce,
  onDigit,
  style,
  children,
}: {
  kb: 'none' | 'text' | 'num';
  landing: number | null;
  leaving: boolean;
  reduce: boolean;
  onDigit: (k: string) => void;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const y = kb === 'none' ? FOOTER_REST : 0;
  return (
    <motion.div
      className={styles.footer}
      style={style}
      initial={landing != null && !reduce ? { y: 372 } : { y }}
      animate={{ y, opacity: leaving ? 0 : 1 }}
      transition={{ ...(landing != null ? move(landing) : MOVE), opacity: fade(0.15) }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className={styles.actionbar}>{children}</div>
      <div className={styles.kb} data-mode={kb}>
        <img className={styles.kbImg} data-kb="text" src={art('keys/keyboard.png')} alt="" />
        <div className={styles.kbImg} data-kb="num">
          <img src={art('keys/numpad.png')} alt="" />
          <Numpad onDigit={onDigit} />
        </div>
      </div>
    </motion.div>
  );
}

/** hotspots over the Figma number pad (keys measured from the 2x export) */
function Numpad({ onDigit }: { onDigit: (k: string) => void }) {
  const cols = [7.15, 129.25, 251.35];
  const rows = [22.39, 74.63, 126.86, 179.1];
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [null, '0', 'del'],
  ];
  return (
    <>
      {rows.flatMap((y, r) =>
        cols.map((x, c) => {
          const k = keys[r][c];
          if (!k) return null;
          return (
            <Pressable
              key={k}
              className={styles.numkey}
              scale={0.96}
              style={{ left: x, top: y }}
              aria-label={k === 'del' ? 'Delete' : k}
              onPointerDown={(e) => {
                e.preventDefault();
                haptics.keyTick();
                onDigit(k);
              }}
            />
          );
        }),
      )}
    </>
  );
}

/** the big centred answer: kit TextField restyled to the Figma 32/40 line; while empty the caret sits before the placeholder */
function BigField({
  value,
  placeholder,
  error,
  autoFocusDelay,
  onFocus,
  onChange,
}: {
  value: string;
  placeholder: string;
  error: boolean;
  autoFocusDelay: number;
  onFocus: (f: boolean) => void;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [phW, setPhW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    }, autoFocusDelay);
    return () => clearTimeout(t);
  }, [autoFocusDelay]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const c = document.createElement('canvas').getContext('2d');
    if (!c) return;
    c.font = getComputedStyle(el).font;
    setPhW(c.measureText(placeholder).width);
  }, [placeholder]);
  const empty = !value;
  return (
    <div className={styles.bigField} data-empty={empty || undefined} onClick={() => ref.current?.focus()}>
      <TextField
        ref={ref}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        labelMode="none"
        aria-label={placeholder}
        maxLength={40}
        error={error}
        autoComplete="off"
        onFocus={() => {
          setFocused(true);
          onFocus(true);
        }}
        onBlur={() => {
          setFocused(false);
          onFocus(false);
        }}
        className={styles.tf}
      />
      {empty && focused && <span className={styles.caret} style={{ left: `calc(50% - ${phW / 2 + 3}px)` }} />}
    </div>
  );
}

function dateValid(d: string) {
  if (d.length !== 8) return false;
  const dd = +d.slice(0, 2),
    mm = +d.slice(2, 4),
    yy = +d.slice(4);
  const dt = new Date(yy, mm - 1, dd);
  return dt.getMonth() === mm - 1 && dt.getDate() === dd;
}

/**
 * The date as the reference types it (r3Date): "dd/mm/yyyy" placeholder with the caret just before it while empty;
 * digits appear with the slashes added as you go ("12", "12/0", "12/05/2026"); backspace removes the last digit (and
 * its slash). Eight digits that are no real day turn red.
 */
function DateText({ digits, bad, active, pickedAt, reduce }: { digits: string; bad: boolean; active: boolean; pickedAt: number; reduce: boolean }) {
  const shown = digits.slice(0, 2) + (digits.length > 2 ? '/' + digits.slice(2, 4) : '') + (digits.length > 4 ? '/' + digits.slice(4, 8) : '');
  return (
    <div className={styles.date} data-bad={bad || undefined} data-empty={!digits || undefined}>
      {digits ? (
        <>
          {/* a picked date arrives: it rises 8 pt and fades in on MOVE (the next pick replaces it the same way) */}
          <motion.span
            key={pickedAt}
            className={styles.dg}
            initial={pickedAt && !reduce ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={arrive(0, 0.22)}
          >
            {shown}
          </motion.span>
          {active && <span className={styles.caretInline} />}
        </>
      ) : (
        <>
          {active && <span className={styles.caretInline} />}
          <span className={styles.ph}>dd/mm/yyyy</span>
        </>
      )}
    </div>
  );
}

/** 1.4 delivery card (Figma 843:723111): icon tile in the occasion tint, address, edit, dashed rule, contact */
function AddressCard({ name, addressKey, onEdit }: { name: string; addressKey: string; onEdit: () => void }) {
  const a = addresses.find((x) => x.key === addressKey) ?? addresses[0];
  return (
    <Pressable className={styles.addr} scale={0.98} onClick={onEdit} aria-label={`Delivery address: ${a.title}`}>
      {/* a new address fades in over the old one (220 ms, as the reference); the old layer goes once it is covered */}
      <AnimatePresence initial={false}>
        <motion.span
          key={a.key}
          className={styles.addrInner}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1, transition: { delay: 0.22, duration: 0 } }}
          transition={fade(0.22)}
        >
          <span className={styles.addrIco}>
            <OriginIcon name={a.icon === 'work' ? 'briefcase-round' : a.icon === 'location' ? 'location' : 'home'} size={20} color="var(--accent)" />
          </span>
          <span className={styles.addrT1}>{a.title}</span>
          <span className={styles.addrT2}>{a.line}</span>
          <span className={styles.addrEdit}>
            <OriginIcon name="edit" size={20} color="var(--nk-color-text-primary)" />
          </span>
          <span className={styles.addrDash}>
            <DashedDivider inset={0} emphasis="high" />
          </span>
          <span className={styles.addrT3}>{a.contact.replace('{name}', name)}</span>
        </motion.span>
      </AnimatePresence>
    </Pressable>
  );
}
