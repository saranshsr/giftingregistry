/**
 * Haptics for the Gift Registry flow: the noon nano haptics system (skill `nano-haptics`), its web vocabulary ported
 * from `assets/haptics.web.js` + `assets/platform.js`, typed. Screens call the named haptics only, never a raw channel.
 *
 * Exactly one channel plays per event:
 *  1. a native iOS host (a WKWebView registering `webkit.messageHandlers.haptic`) gets a real Taptic pulse
 *     ({ type, intensity });
 *  2. iOS Safari 17.4+: no Vibration API, but toggling an <input type=checkbox switch> plays the system tick. There is
 *     one fixed strength, so stronger = a tighter burst of ticks; WebKit only plays it within ~1 s of a real tap;
 *  3. Android / Chrome: navigator.vibrate pulses (longer = stronger). Desktop stays silent.
 *
 * Named haptics (nano vocabulary → web recipe):
 *   press        primary CTA touch-down                       native heavy 1.0 · Android 110 ms · iOS Safari 5 ticks
 *   release      primary CTA touch-up                         native light 0.4 · Android 60 ms · iOS Safari silent
 *   lift         tiles that rise (Gift Registries card, list   light (4 ticks / 60 ms)
 *                tiles)
 *   tap          secondary actions (+ Create, Pick from        light
 *                calendar)
 *   lightTap     field focus, toggles, sheet / picker open,    selection (3 ticks / 40 ms)
 *                back / close
 *   selectionTick a choice changing without commit            selection
 *   keyTick      keypad digits                                selection
 *   swipe        a sheet dismissed by drag                    light
 *   aborted      a drag released short                        selection
 *   settle       something landing                            settle (5 ticks / 70 ms)
 *   success      a real completion only (after settle)        success (8 ticks / 70·50·90 ms)
 *   failure      an invalid CTA, with the shake               error (11 ticks / 80·40·80·40·100 ms)
 *   cue(kind)    lottie frame cues                            light / medium / heavy / selection
 *
 * Rules kept from the skill: one haptic per change (the tap listener stands down when a handler already played, and
 * `data-haptic="off"` silences an element), anything repeating stays light, success / failure only for real outcomes,
 * play on the landing frame and skip a late cue, never on something the user didn't do, and one app-wide switch.
 */

/* ── platform (assets/platform.js) ─────────────────────────────────────────────────────────────────────────── */

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
const platform = typeof navigator === 'undefined' ? '' : navigator.platform || '';
const appleWebKit = typeof navigator !== 'undefined' && navigator.vendor === 'Apple Computer, Inc.';
/** a real iPhone / iPad (desktop Chrome emulating one still reports "Google Inc."; iPadOS reports a touch Mac) */
export const isIOS = (/iP(hone|ad|od)/.test(ua) && appleWebKit) || (platform === 'MacIntel' && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
/** a real Android phone (an emulated Pixel on a desktop keeps its desktop navigator.platform) */
export const isAndroid = /Android/i.test(ua) && !/Win|Mac|Linux x86|Linux i[3-6]86/.test(platform);

/* ── channels (assets/haptics.web.js) ──────────────────────────────────────────────────────────────────────── */

type NativeType = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' | 'success' | 'error';
type NativePulse = [ms: number, type: NativeType, intensity?: number];
interface HapticBridge {
  postMessage: (m: unknown) => void;
}
const bridge = (): HapticBridge | null => (window as unknown as { webkit?: { messageHandlers?: { haptic?: HapticBridge } } }).webkit?.messageHandlers?.haptic ?? null;

/** a fresh hidden switch per tick: display:none can never take focus, so a focused field keeps the keyboard up */
function iosTick() {
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.display = 'none';
  const sw = document.createElement('input');
  sw.type = 'checkbox';
  sw.setAttribute('switch', '');
  label.appendChild(sw);
  document.head.appendChild(label);
  const active = document.activeElement as HTMLElement | null;
  label.click();
  label.remove();
  if (active && active !== document.body && document.activeElement !== active) active.focus({ preventScroll: true });
}

let enabled = true;
let lastAt = -1;
const DEV = import.meta.env.DEV;

function play(kind: string, native: [NativeType, number?] | NativePulse[], iosOffsets: number[], androidPattern: number | number[]) {
  if (!enabled) return;
  lastAt = performance.now();
  if (DEV) console.info(`[haptic] ${kind}`);
  try {
    const h = bridge();
    if (h) {
      const pulses: NativePulse[] = Array.isArray(native[0]) ? (native as NativePulse[]) : [[0, ...(native as [NativeType, number?])]];
      for (const [ms, type, intensity] of pulses) {
        const post = () => {
          try {
            h.postMessage(intensity == null ? type : { type, intensity });
          } catch {
            /* host went away */
          }
        };
        if (ms) setTimeout(post, ms);
        else post();
      }
    } else if (isIOS) {
      for (const ms of iosOffsets) {
        if (ms === 0) iosTick();
        else setTimeout(iosTick, ms);
      }
    } else if (typeof navigator.vibrate === 'function') {
      const ua2 = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
      if (!ua2 || ua2.hasBeenActive) navigator.vibrate(androidPattern);
    }
  } catch {
    /* haptics are an enhancement only */
  }
}

/** the web levels (strengthened nano values, as the skill's haptics.web.js) */
const level = {
  selection: (k: string) => play(k, ['medium', 1], [0, 25, 50], 40),
  light: (k: string) => play(k, ['heavy', 1], [0, 24, 48, 72], 60),
  medium: (k: string) => play(k, ['heavy', 1], [0, 22, 44, 66, 88], 80),
  heavy: (k: string) => play(k, ['heavy', 1], [0, 20, 40, 60, 80, 100, 120], 110),
  settle: (k: string) => play(k, ['heavy', 1], [0, 24, 48, 72, 96], 70),
  success: (k: string) =>
    play(
      k,
      [
        [0, 'success'],
        [140, 'heavy', 1],
      ],
      [0, 24, 48, 72, 140, 164, 188, 212],
      [70, 50, 90],
    ),
  error: (k: string) =>
    play(
      k,
      [
        [0, 'error'],
        [200, 'heavy', 1],
      ],
      [0, 24, 48, 72, 110, 134, 158, 200, 224, 248, 272],
      [80, 40, 80, 40, 100],
    ),
};

/* ── the named haptics ─────────────────────────────────────────────────────────────────────────────────────── */

export type CueKind = 'light' | 'medium' | 'heavy' | 'selection';

export const haptics = {
  /**
   * nano press / release = heavy 1.0 on touch-down, light 0.4 on touch-up (rule 2: the release is softer). Where the
   * platform carries strength: the native bridge gets exactly those, Android the heavy (110 ms) / light (60 ms) pulses.
   * iOS Safari's switch has one fixed tick, so press keeps its 5-tick burst and release stays silent (it still marks
   * `lastAt`, so the tap listener doesn't add a second haptic to the same tap).
   */
  press: () => play('press', ['heavy', 1], [0, 22, 44, 66, 88], 110),
  release: () => play('release', ['light', 0.4], [], 60),
  lift: () => level.light('lift'),
  tap: () => level.light('tap'),
  lightTap: () => level.selection('lightTap'),
  selectionTick: () => level.selection('selectionTick'),
  keyTick: () => level.selection('keyTick'),
  swipe: () => level.light('swipe'),
  aborted: () => level.selection('aborted'),
  failure: () => level.error('failure'),
  settle: () => level.settle('settle'),
  success: () => level.success('success'),
  /** something lands and completes: settle on the landing, success ~160 ms later (skill rule 5) */
  settleThenSuccess: () => {
    level.settle('settle');
    setTimeout(() => level.success('success'), 160);
  },
  /** a lottie frame cue */
  cue: (kind: CueKind) => level[kind](`cue:${kind}`),
  /** when the last haptic played (performance.now()), for "skip a cue too close to the last one" */
  get lastAt() {
    return lastAt;
  },
};

/** the one app-wide switch */
export const setHapticsEnabled = (on: boolean) => {
  enabled = on;
};

/* ── the tap listener (installTapHaptics), scoped to this flow's screens ────────────────────────────────────── */

const FIELD = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, select';
const TAPPABLE = 'button, a[href], [role="button"], [role="tab"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"], label, [data-haptic]';
const CHOICE = '[role="radio"], [role="checkbox"], [role="tab"], [role="switch"], [role="option"], [aria-checked], [aria-pressed]';
type Named = Exclude<keyof typeof haptics, 'lastAt' | 'cue' | 'settleThenSuccess'>;

const kindFor = (el: Element, field: boolean): Named => {
  const own = (el.closest('[data-haptic]') as HTMLElement | null)?.dataset.haptic;
  if (own && own !== 'off' && own in haptics) return own as Named;
  // a text field or a choice changing is a light tick; any other control a light tap (the nano web listener plays
  // `selection` / `light`; here they carry their vocabulary names)
  if (field || el.matches(CHOICE)) return 'lightTap';
  return 'tap';
};
const isDisabled = (el: Element) => (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true' || !!el.closest('[aria-disabled="true"], fieldset:disabled');

let installed = false;
/**
 * Prepare on screen appear (skill rule 8): installs the flow's one tap listener once. On the web there are no
 * generators to warm, so this is all a screen needs to call. A tap on a control inside a `giftregistry/*` screen plays
 * its kind unless the control's own handler already played one for that tap, or it sits inside `data-haptic="off"`.
 */
export function prepareHaptics() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener(
    'click',
    (e) => {
      if (!e.isTrusted) return; // the iOS haptic itself is a scripted label click
      const target = e.target instanceof Element ? e.target : null;
      if (!target || !target.closest('[data-route^="giftregistry/"]')) return;
      const field = target.closest(FIELD);
      const el = field ?? target.closest(TAPPABLE);
      if (!el || isDisabled(el) || el.closest('[data-haptic="off"]')) return;
      const at = performance.now();
      if (lastAt > at - 80) return; // a label's forwarded click, same tap
      const kind = kindFor(el, !!field);
      setTimeout(() => {
        if (lastAt >= at) return; // the control's own handler played one
        haptics[kind]();
      }, 0);
    },
    true,
  );
}
