import type { DotLottie } from '@lottiefiles/dotlottie-react';
import { AnimatePresence, motion, useAnimate, usePresence, usePresenceData } from 'motion/react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Lottie } from '../../../components';
import { useReduceMotion } from '../../../motion/reducedMotion';
import { haptics } from '../haptics';
import { fade, fadeOut } from '../motion';

/**
 * The step's hero lottie (375 × 176 at top 104: the Figma "Onboarding hero" frame plus 14 pt above), played once and
 * held on its last frame, through the kit `Lottie`.
 *
 * - A new step (`playKey` changes): the old hero fades out with a slight shrink (to 0.92), the new one plays from 0
 *   after `delay` seconds.
 * - Same step, new `src` (picking another occasion on 1.1): the new file is set to the frame the current one shows
 *   at the moment it is ready (its last frame once it has finished; still playing if it was), then cross-fades in over
 *   450 ms on ease-out cubic. Only the ribbon's colour changes; nothing replays.
 * - Star pulse (1.1 only): when that re-pick lands after the intro has finished, the two pulsing stars play their AE
 *   pulse once, starting with the cross-fade, while the rest of the illustration holds still. See `PULSE` below.
 *
 * Refined against the reference (regHero.setTheme: a 700 ms material-standard fade of a copy over the PNG arc, after
 * the art has decoded): the fade is the kit's 450 ms ease-out, it waits until the new file has drawn its first frame
 * (the reference's decode wait, applied to the lottie), and the outgoing hero stays fully opaque underneath until the
 * new one is fully in, so a slow load or a quick re-pick never shows a gap or a dip in the art.
 *
 * `cue` (nano frame cue): one light haptic on the hero's landing frame, fired from the lottie's own clock, only when
 * `cue.ok()` (the step change came from a tap), never on a swap, and skipped rather than played late (> 0.25 s behind)
 * or within 150 ms of the last haptic.
 */
export interface HeroCue {
  frame: number;
  ok: () => boolean;
}
export function HeroLottie({ src, playKey, delay = 0, cue }: { src: string; playKey: string; delay?: number; cue?: HeroCue }) {
  const shared = useRef<Shared>({ live: { key: '', d: null }, waiting: new Set(), players: new Set(), pulse: null });
  // how the layer on screen leaves: held under the next file when the same step swaps files, the shrink-fade on a new step
  const last = useRef(playKey);
  const mode: Mode = last.current === playKey ? 'swap' : 'step';
  useEffect(() => {
    last.current = playKey;
  }, [playKey]);
  // unmounting mid-pulse: stop the shared clock (its waiters resolve, so no recolour hold is left behind)
  useEffect(() => () => stopPulse(shared.current), []);
  useEffect(warmPulseFiles, []);
  return (
    <div style={{ position: 'absolute', left: 0, top: 104, width: 375, height: 176, pointerEvents: 'none', zIndex: 2 }}>
      <AnimatePresence initial={false} custom={mode}>
        <Layer key={`${playKey}|${src}`} src={src} playKey={playKey} delay={delay} shared={shared} cue={cue} />
      </AnimatePresence>
    </div>
  );
}

type Mode = 'swap' | 'step';
interface Shared {
  /** the player of the newest layer that has started (the frame source for a swap) */
  live: { key: string; d: DotLottie | null };
  /** swapped-out layers waiting for the newcomer to be fully in before they leave */
  waiting: Set<() => void>;
  /** every mounted pulse-capable (1.1) player, incoming and outgoing: the pulse clock drives them all in lockstep */
  players: Set<DotLottie>;
  /** the running star pulse: its start time and the promise that settles when it ends */
  pulse: { at: number; raf: number; frame: number; done: Promise<void>; end: () => void } | null;
}

/** longest an outgoing layer waits for its successor (a file that fails to load) */
const HOLD_MAX = 2000;

// ---- star pulse -------------------------------------------------------------------------------------------------
/**
 * AE "GR hero 1.1 Occasion - Default" (60 fps, 3.4 s = frames 0–203), read from the comp and identical in every
 * occasion's export: after the illustration settles, only "bit 2 (ill_bit4)" and "bit 3 (ill_bit6)" pulse.
 * Scale 100 → 122 → 93 → 100 on frames 111 / 119 / 129 / 140 (bit 2) and 136 / 145 / 154 / 165 (bit 3), each key
 * an easy-ease at 40 % influence (cubic 0.4, 0, 0.6, 1). Over the same frames the "illustration rig" bobs
 * (position y 413 → 407 at 129 → 413 at 180), so replaying 111–165 of the file would move the whole illustration.
 *
 * Instead, each 1.1 file is loaded with that pulse appended after its last frame: the two bits' scale keys from
 * 111–165, copied to 204–258, where every other layer (rig included) is already at rest. Frames 0–203 are untouched
 * and playback is held to them (`setSegment(0, 203)`); a pulse scrubs 204 → 258 on one clock for every mounted 1.1
 * player, so the outgoing hero under the cross-fade pulses in lockstep with the incoming one (its stars never peek
 * out from under the smaller ones) and the stars are the lottie's own pixels. 204 and 258 draw exactly like 203.
 */
const PULSE_FROM = 111;
const PULSE_TO = 165;
const FPS = 60;
const isPulseFile = (src: string) => /gr-hero-1-1-occasion-/.test(src);
const pulseFiles = import.meta.glob('../../../assets/giftregistry/lottie/gr-hero-1-1-occasion-*.lottie', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

interface PulseFile {
  /** blob URL of the extended JSON */
  url: string;
  /** the original last frame (where the intro rests) and the appended pulse range */
  rest: number;
  a: number;
  b: number;
}
const derived = new Map<string, Promise<PulseFile | null>>();
const resolved = new Map<string, PulseFile | null>();

/** the .lottie's animation JSON (the files here are a single deflated JSON with its images inlined as data URIs) */
async function readLottieJson(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url, { cache: 'force-cache' })).arrayBuffer());
  const v = new DataView(buf.buffer);
  let e = buf.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip');
  const n = v.getUint16(e + 10, true);
  let p = v.getUint32(e + 16, true);
  const text = new TextDecoder();
  for (let i = 0; i < n; i++) {
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const name = text.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
    if (!/^animations\/.+\.json$/.test(name)) continue;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const raw = buf.slice(start, start + size);
    if (method === 0) return text.decode(raw);
    return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  }
  throw new Error('no animation in ' + url);
}

type Key = { t: number; s: number[]; o?: unknown; i?: unknown; h?: number };
function pulseFile(src: string): Promise<PulseFile | null> {
  let p = derived.get(src);
  if (!p) {
    p = readLottieJson(src)
      .then((json) => {
        const anim = JSON.parse(json) as { op: number; layers: { op: number; ks?: { s?: { a: number; k: Key[] } } }[] };
        const op = anim.op;
        const shift = op - PULSE_FROM;
        let found = false;
        for (const l of anim.layers) {
          const s = l.ks?.s;
          if (s?.a !== 1) continue;
          const tail = s.k.filter((k) => k.t >= PULSE_FROM && k.t <= PULSE_TO);
          if (!tail.length) continue;
          found = true;
          // the last key gets a (flat) ease so the value holds until the copy starts
          const last = s.k[s.k.length - 1];
          if (!last.o) Object.assign(last, { o: { x: [0.167, 0.167], y: [0.167, 0.167] }, i: { x: [0.833, 0.833], y: [0.833, 0.833] } });
          s.k.push(...tail.map((k) => ({ ...(JSON.parse(JSON.stringify(k)) as Key), t: k.t + shift })));
        }
        if (!found) return null;
        const b = PULSE_TO + shift;
        for (const l of anim.layers) if (l.op >= op) l.op = b + 1;
        anim.op = b + 1;
        const url = URL.createObjectURL(new Blob([JSON.stringify(anim)], { type: 'application/json' }));
        return { url, rest: op - 1, a: op, b };
      })
      .catch(() => null)
      .then((f) => (resolved.set(src, f), f));
    derived.set(src, p);
  }
  return p;
}
/** derive the eight 1.1 files ahead of time, in idle slices (they are already in the HTTP cache from warmFlow) */
let warmed = false;
function warmPulseFiles() {
  if (warmed) return;
  warmed = true;
  const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1));
  const urls = Object.entries(pulseFiles)
    .sort(([a], [b]) => Number(/default|birthday/.test(b)) - Number(/default|birthday/.test(a)))
    .map(([, u]) => u);
  const next = () => {
    const u = urls.shift();
    if (u) idle(() => void pulseFile(u).then(next));
  };
  next();
}

/** start the shared pulse clock: scrubs every mounted 1.1 player through the appended range, then parks them at rest */
function startPulse(s: Shared, f: PulseFile): Promise<void> {
  if (s.pulse) return s.pulse.done;
  let end!: () => void;
  const done = new Promise<void>((r) => (end = r));
  const at = performance.now();
  const pulse = { at, raf: 0, frame: f.a, done, end };
  s.pulse = pulse;
  const tick = (ts: number) => {
    if (s.pulse !== pulse) return;
    const frame = f.a + (Math.max(0, ts - at) / 1000) * FPS;
    if (frame >= f.b || !s.players.size) return stopPulse(s, f);
    pulse.frame = frame;
    s.players.forEach((d) => d.setFrame(frame));
    pulse.raf = requestAnimationFrame(tick);
  };
  s.players.forEach((d) => (d.resetSegment(), d.setFrame(f.a)));
  pulse.raf = requestAnimationFrame(tick);
  return done;
}
function stopPulse(s: Shared, f?: PulseFile) {
  const pulse = s.pulse;
  if (!pulse) return;
  cancelAnimationFrame(pulse.raf);
  s.pulse = null;
  if (f) s.players.forEach((d) => park(d, f));
  pulse.end();
}
/** hold a 1.1 player to the original frames and show its resting frame */
const park = (d: DotLottie, f: PulseFile) => (d.setSegment(0, f.rest), d.setFrame(f.rest));

// ---- recolour queue ---------------------------------------------------------------------------------------------
/**
 * One recolour in flight on 1.1. Each piece of a recolour (the incoming hero until its cross-fade and star pulse are
 * done, the incoming page wash until its cross-fade is done) holds it; `useRecolourQueue` hands its caller a new
 * occasion only when nothing holds, so picks made mid-recolour update the tiles at once but only the latest one is
 * played next, after the current one has finished. Every hold also ends on unmount and after a time-out, so the
 * queue can never stall.
 */
const recolour = { n: 0, subs: new Set<() => void>() };
const HOLD_LIMIT = 3000;
export function holdRecolour(): () => void {
  recolour.n++;
  let held = true;
  const t = setTimeout(() => release(), HOLD_LIMIT);
  const release = () => {
    if (!held) return;
    held = false;
    clearTimeout(t);
    recolour.n--;
    if (!recolour.n) [...recolour.subs].forEach((f) => f());
  };
  return release;
}
/** the occasion the hero, page wash and CTA should show: `picked`, one recolour at a time, intermediate picks skipped */
export function useRecolourQueue<T>(picked: T): T {
  const [shown, setShown] = useState(picked);
  const latest = useRef(picked);
  latest.current = picked;
  const showing = useRef(picked);
  // set from the moment a recolour is handed out until it has committed (and its pieces have taken their holds)
  const starting = useRef(false);
  const run = useRef(() => {});
  run.current = () => {
    if (starting.current || recolour.n > 0 || Object.is(latest.current, showing.current)) return;
    starting.current = true;
    showing.current = latest.current;
    setShown(latest.current);
  };
  // the new layers' mount effects (children) have run before this one, so their holds are in place
  useEffect(() => {
    starting.current = false;
    run.current();
  }, [shown]);
  useEffect(() => run.current(), [picked]);
  useEffect(() => {
    const f = () => run.current();
    recolour.subs.add(f);
    return () => void recolour.subs.delete(f);
  }, []);
  return shown;
}

// ---- layer -----------------------------------------------------------------------------------------------------
function Layer({ src, playKey, delay, shared, cue }: { src: string; playKey: string; delay: number; shared: RefObject<Shared>; cue?: HeroCue }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [isPresent, safeToRemove] = usePresence();
  const reduce = useReduceMotion();
  // AnimatePresence's `custom`, current even for a layer that is already leaving
  const mode = (usePresenceData() as Mode | undefined) ?? 'step';
  // the layer this one takes over from (same step = a swap); its frame is read when this one is ready, not now
  const from = useRef<DotLottie | null | undefined>(undefined);
  if (from.current === undefined) {
    const prev = shared.current.live;
    from.current = prev.key === playKey && prev.d ? prev.d : null;
  }
  const swap = from.current !== null;
  const started = useRef(false);
  const present = useRef(isPresent);
  present.current = isPresent;
  const t0 = useRef(performance.now());
  const player = useRef<DotLottie | null>(null);

  // 1.1 files play from their pulse-extended copy (undefined = still deriving; null = not a 1.1 file / failed: as is)
  const pulseable = isPulseFile(src);
  const [file, setFile] = useState<PulseFile | null | undefined>(() => (pulseable ? resolved.get(src) : null));
  useEffect(() => {
    if (file !== undefined) return;
    let live = true;
    pulseFile(src).then((f) => live && setFile(f));
    return () => void (live = false);
  }, [src, file]);

  // a swap holds the recolour queue until its cross-fade (and star pulse) are done, or it unmounts
  const hold = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!swap) return;
    const release = holdRecolour();
    hold.current = release;
    return release;
  }, [swap]);

  // leaving: on a swap, stay put until the successor has faded in; on a new step, the shrink-fade
  useEffect(() => {
    if (isPresent) return;
    if (mode === 'step') {
      animate(scope.current, { opacity: 0, scale: 0.92 }, fadeOut(0.2)).then(() => safeToRemove());
      return;
    }
    const release = () => {
      shared.current.waiting.delete(release);
      safeToRemove();
    };
    shared.current.waiting.add(release);
    const t = setTimeout(release, HOLD_MAX);
    return () => clearTimeout(t);
  }, [isPresent, mode, animate, scope, safeToRemove, shared]);

  // unmounting: leave the pulse clock's set
  useEffect(
    () => () => {
      const d = player.current;
      if (d) shared.current.players.delete(d);
    },
    [shared],
  );

  const reveal = (pulse?: Promise<void>) => {
    // only the newest layer lets the ones under it go (a layer that is itself leaving keeps them)
    const flush = () => present.current && [...shared.current.waiting].forEach((r) => r());
    if (!swap) {
      animate(scope.current, { opacity: 1 }, { duration: 0 });
      flush();
      return;
    }
    const faded = animate(scope.current, { opacity: 1 }, fade(0.45)).then(flush);
    Promise.all([faded, pulse]).then(() => hold.current?.());
  };

  const start = (d: DotLottie) => {
    if (started.current) return;
    started.current = true;
    player.current = d;
    const s = shared.current;
    s.live = { key: playKey, d };
    const f = file ?? null;
    if (f) {
      d.setSegment(0, f.rest);
      s.players.add(d);
    }
    const prev = from.current;
    if (prev) {
      const prevPulses = f && s.players.has(prev);
      let pulse: (() => Promise<void>) | undefined;
      if (f && s.pulse && prevPulses) {
        // a pulse is already running: join it on its current frame
        d.resetSegment();
        d.setFrame(s.pulse.frame);
        const running = s.pulse.done;
        pulse = () => running;
      } else if (f && prevPulses && !prev.isPlaying && prev.currentFrame >= f.rest - 0.5 && !reduce) {
        // the intro has finished: the stars pulse once, starting with the cross-fade
        d.setFrame(f.rest);
        pulse = () => startPulse(s, f);
      } else {
        // pick up exactly where the outgoing file is now (still playing during the intro: no pulse, it already moves)
        d.setFrame(Math.min(prev.currentFrame, f ? f.rest : d.totalFrames - 1));
        if (prev.isPlaying) d.play();
      }
      // fade in once that frame has been drawn
      let shown = false;
      const once = () => {
        if (shown) return;
        shown = true;
        d.removeEventListener('render', once);
        reveal(pulse?.());
      };
      d.addEventListener('render', once);
      requestAnimationFrame(() => requestAnimationFrame(once));
      return;
    }
    reveal();
    const wait = Math.max(0, delay * 1000 - (performance.now() - t0.current));
    setTimeout(() => d.play(), wait);
    if (cue) {
      const onFrame = ({ currentFrame }: { currentFrame: number }) => {
        if (currentFrame < cue.frame) return;
        d.removeEventListener('frame', onFrame);
        const late = (currentFrame - cue.frame) / FPS > 0.25;
        if (!late && present.current && cue.ok() && performance.now() - haptics.lastAt > 150) haptics.cue('light');
      };
      d.addEventListener('frame', onFrame);
    }
  };

  return (
    // `initial`, not `style`: a style opacity would be re-applied when the layer re-renders on leaving and cut the
    // shrink-fade to an instant hide
    <motion.div ref={scope} style={{ position: 'absolute', inset: 0 }} initial={{ opacity: 0 }} data-hero-src={src.split('/').pop()}>
      {file !== undefined && (
        <Lottie
          src={file?.url ?? src}
          autoplay={false}
          // perf: rendered in a worker (the wasm never blocks a transition) at no more than 2× density
          worker
          maxDpr={2}
          style={{ width: '100%', height: '100%' }}
          onPlayer={(d) => {
            if (d.isLoaded) start(d);
            else d.addEventListener('load', () => start(d));
          }}
        />
      )}
    </motion.div>
  );
}
