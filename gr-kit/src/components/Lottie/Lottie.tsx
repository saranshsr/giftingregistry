import { DotLottieReact, DotLottieWorkerReact } from '@lottiefiles/dotlottie-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import type { DotLottie } from '@lottiefiles/dotlottie-react';
import { useReduceMotion } from '../../motion/reducedMotion';
import atcCheck from '@assets/lotties/atc-check.lottie';
import boxAnim from '@assets/lotties/box-anim.lottie';
import favourite from '@assets/lotties/favouriteAnimatedV2.lottie';
import orderConf from '@assets/lotties/order-conf-lottie.lottie';
import orderConfirmedCheck from '@assets/lotties/order-confirmed-checkmark.lottie';
import reviewCheck from '@assets/lotties/noon-review-check-mark-animation.lottie';
import sliderArrow from '@assets/lotties/slider-arrow-animation-en.lottie';
import starLoading from '@assets/lotties/star-loading.lottie';

/** Lottie files copied from bappzaar `marketplaces/noon/theme/assets`. Drop more .lottie files in src/assets/lotties and add them here. */
export const lotties = {
  atcCheck,
  boxAnim,
  favourite,
  orderConf,
  orderConfirmedCheck,
  reviewCheck,
  sliderArrow,
  starLoading,
} as const;

export type LottieName = keyof typeof lotties;

/** set by public/spec/proto.html: the app is being recorded by the Animation Spec Sheet */
const SPEC = typeof window !== 'undefined' && !!(window as unknown as { __NK_SPEC__?: boolean }).__NK_SPEC__;

/**
 * Spec sheet only: its preview is a script-free copy of the page, where a <canvas> stays blank. So the player's canvas
 * carries its file (`data-spec-lottie`) and the frame it shows (`data-lf`, every drawn frame); the sheet redraws that
 * frame with lottie-web on top of the copy's canvas.
 */
function specTag(d: DotLottie, src: string | undefined) {
  const tag = () => {
    const c = d.canvas as HTMLCanvasElement | null;
    if (!c || !(c instanceof HTMLCanvasElement) || !src) return;
    c.setAttribute('data-spec-lottie', new URL(src, location.href).href);
    c.setAttribute('data-lf', String(Math.round(d.currentFrame * 100) / 100));
  };
  for (const ev of ['load', 'frame', 'play', 'stop', 'pause', 'complete', 'loop'] as const) d.addEventListener(ev, tag);
  tag();
}

/**
 * Where a held (reduced-motion) Lottie rests, as a share of its length: `'auto'` (default) = the last frame for a
 * one-shot, the middle for a loop, but never a blank frame (many one-shots end empty, e.g. the account country /
 * language change); a number 0–1 pins it (the poster frame).
 */
export type LottiePoster = 'auto' | number;

/** frames sampled (as shares of the length) when choosing the held frame automatically */
const POSTER_CANDIDATES = [1, 0.85, 0.7, 0.55, 0.4, 0.25];
const PROBE = 48;
/** the latest poster-sampling run per player (ref callbacks can attach twice, e.g. StrictMode) */
const sampling = new WeakMap<DotLottie, object>();

/**
 * How much the player's canvas currently shows: the number of probe pixels (48×48 copy, so it works for any renderer)
 * that differ from the frame's background (its top-left pixel). 0 = blank or one flat colour. -1 = unreadable.
 */
function canvasContent(d: DotLottie) {
  const src = d.canvas as HTMLCanvasElement | null;
  if (!src || !(src instanceof HTMLCanvasElement) || !src.width || !src.height) return -1;
  try {
    const probe = document.createElement('canvas');
    probe.width = probe.height = PROBE;
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    if (!ctx) return -1;
    ctx.drawImage(src, 0, 0, PROBE, PROBE);
    const px = ctx.getImageData(0, 0, PROBE, PROBE).data;
    const lum = (i: number) => ((px[i] + px[i + 1] + px[i + 2]) / 3) * (px[i + 3] / 255);
    const bg = lum(0);
    let n = 0;
    for (let i = 0; i < px.length; i += 4) if (Math.abs(lum(i) - bg) > 12) n++;
    return n;
  } catch {
    return -1;
  }
}

/**
 * Reduced-motion handling for a DotLottie player, shared by `<Lottie>` and flows that use `DotLottieReact` directly
 * (e.g. for `layout` / segments): under `useReduceMotion()` nothing autoplays; the player holds one representative
 * frame (`poster`: the last frame of a one-shot, the middle of a loop, skipping blank frames) and a one-shot still
 * calls `onComplete` after its normal length (flows that navigate on completion keep their timing). Pass `autoplay`
 * to the player and call `attach(d)` from `dotLottieRefCallback`. Players you drive yourself (scrubbed by a gesture)
 * don't need it.
 */
export function useLottieReducedMotion({ loop = false, autoplay = true, speed = 1, onComplete, poster = 'auto' }: { loop?: boolean; autoplay?: boolean; speed?: number; onComplete?: () => void; poster?: LottiePoster }) {
  const reduce = useReduceMotion();
  const doneTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(doneTimer.current), []);
  const holdStill = (d: DotLottie) => {
    const last = Math.max(0, d.totalFrames - 1);
    const at = (share: number) => Math.round(Math.min(1, Math.max(0, share)) * last);
    if (typeof poster === 'number') d.setFrame(at(poster));
    else {
      // sample a few frames and hold the one that shows the most (many one-shots end blank or mid-fade); the
      // preferred frame (last / middle) wins unless another shows clearly more
      const preferred = loop ? 0.5 : 1;
      const tries = [preferred, ...POSTER_CANDIDATES.filter((c) => c !== preferred)];
      const scores: number[] = [];
      const run = {};
      sampling.set(d, run);
      const step = (k: number) => {
        d.setFrame(at(tries[k]));
        // read two frames later (the player draws on its own frame); a newer run on the same player wins
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (sampling.get(d) !== run) return;
          scores[k] = canvasContent(d);
          if (scores[0] < 0) return; // unreadable canvas: keep the preferred frame
          if (k + 1 < tries.length) return step(k + 1);
          const best = scores.reduce((b, v, i) => (v > scores[b] ? i : b), 0);
          d.setFrame(at(scores[0] >= scores[best] * 0.8 ? tries[0] : tries[best]));
        }));
      };
      step(0);
    }
    if (!loop && onComplete) {
      clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(onComplete, (d.duration * 1000) / (speed || 1));
    }
  };
  return {
    reduce,
    autoplay: autoplay && !reduce,
    attach: (d: DotLottie | null) => {
      if (!d || !reduce || !autoplay) return;
      if (d.isLoaded) holdStill(d);
      else d.addEventListener('load', () => holdStill(d));
    },
  };
}

/**
 * `onLoad` fires once the animation data has loaded (playback starts then when autoplay); `onComplete` when a non-looping play ends.
 * Reduced motion: see `useLottieReducedMotion` (no autoplay; a held representative frame — `reducedMotionFrame` pins it —
 * and `onComplete` still on time).
 */
export function Lottie({ name, src, loop = false, autoplay = true, size, style, speed = 1, onComplete, onLoad, onPlayer, reducedMotionFrame = 'auto', worker = false, maxDpr }: { name?: LottieName; src?: string; loop?: boolean; autoplay?: boolean; size?: number; style?: CSSProperties; speed?: number; onComplete?: () => void; onLoad?: () => void; /** the DotLottie player, for callers that drive frames themselves (seek, cross-fade at the same frame) */ onPlayer?: (d: DotLottie) => void; /** reduced motion: the frame to hold, as a share 0–1 of the length (default `'auto'`: last / middle, never blank) */ reducedMotionFrame?: LottiePoster; /** opt-in: render in a Web Worker (OffscreenCanvas) so the wasm never blocks the main thread; same player API, its methods resolve asynchronously */ worker?: boolean; /** opt-in: cap the canvas resolution (device pixel ratio), e.g. 2 on 3× phones */ maxDpr?: number }) {
  const rm = useLottieReducedMotion({ loop, autoplay, speed, onComplete, poster: reducedMotionFrame });
  // the spec sheet runs the app on a virtual clock: a worker player would keep real time there, so it stays on the main thread
  const Player = worker && !SPEC ? DotLottieWorkerReact : DotLottieReact;
  const renderConfig = maxDpr && typeof window !== 'undefined' ? { devicePixelRatio: Math.min(window.devicePixelRatio || 1, maxDpr) } : undefined;
  return (
    <Player
      src={src ?? (name ? lotties[name] : undefined)}
      renderConfig={renderConfig}
      loop={loop}
      autoplay={rm.autoplay}
      speed={speed}
      style={{ width: size, height: size, ...style }}
      dotLottieRefCallback={(p: unknown) => {
        // the worker player mirrors DotLottie's API (methods resolve asynchronously)
        const d = p as DotLottie | null;
        if (!d) return;
        if (onComplete) d.addEventListener('complete', onComplete);
        if (onLoad) d.addEventListener('load', onLoad);
        onPlayer?.(d);
        rm.attach(d);
        if (SPEC) specTag(d, src ?? (name ? lotties[name] : undefined));
      }}
    />
  );
}
