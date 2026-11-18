import { useEffect, useRef, useState } from 'react';
import { useIsTop } from '../../../../kit/Navigator';
import { useReduceMotion } from '../../../../motion/reducedMotion';
import { grStore } from '../../store';
import { giftregistryTokens } from '../../tokens';

/**
 * The Account card's Gift Registries teaser clock (reference flow 6: widget.js `play()`, states 01 → 05 at
 * 800 / 1400 / 4700 / 5350 ms). Runs once per load of the flow: `grStore.introPlayed` is a module store, so coming
 * back to Account rests on 05 and the review shell's Restart (a full reload) runs it again. Like the reference's phone
 * path it holds 01 until the card art has decoded (capped), so the promo never rises half-painted. Reduced motion
 * rests on 05. If My Lists is opened mid-teaser (the card stays tappable), the teaser finishes out of sight once the
 * push has covered Account, so Back lands on the resting card rather than the tail of the promo.
 */
export type IntroState = 's01' | 's02' | 's03' | 's04' | 's05';

/** one highlight sweep over "Gift Registries" once the promo has settled (reference: 950 ms after 03; MOVE settles
 *  sooner, so the sweep follows sooner) */
export const SHIMMER_AFTER = 750;
/** longest the intro waits for its art before it starts anyway */
const ART_WAIT = 1200;
/** a covered Account settles after the push has landed (gr-push rides MOVE, ~0.5 s) */
const SETTLE_AFTER = 500;

const decoded = (srcs: string[]) =>
  Promise.race([
    Promise.all(
      srcs.map((src) => {
        const i = new Image();
        i.src = src;
        return i.decode().catch(() => undefined);
      }),
    ),
    new Promise((r) => setTimeout(r, ART_WAIT)),
  ]);

export function useCardIntro(art: string[]) {
  const reduce = useReduceMotion();
  // decided once, on mount: a later visit (or reduced motion) shows the resting state
  const [skip] = useState(() => reduce || grStore.get().introPlayed);
  const [state, setState] = useState<IntroState>(skip ? 's05' : 's01');
  const [shimmer, setShimmer] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const settled = useRef(false);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    if (skip) return;
    grStore.patch({ introPlayed: true });
    const t = giftregistryTokens.intro;
    let live = true;
    decoded(art).then(() => {
      if (!live || settled.current) return;
      grStore.patch({ introStartedAt: performance.now() }); // "Need help?" folds 1 s after this (AccountScreen)
      timers.current = [
        setTimeout(() => setState('s02'), t.s02),
        setTimeout(() => setState('s03'), t.s03),
        setTimeout(() => setShimmer((n) => n + 1), t.s03 + SHIMMER_AFTER),
        setTimeout(() => setState('s04'), t.s04),
        setTimeout(() => setState('s05'), t.s05),
      ];
    });
    return () => {
      live = false;
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isTop = useIsTop();
  useEffect(() => {
    if (isTop || skip) return;
    const id = setTimeout(() => {
      settled.current = true;
      clear();
      setState('s05');
    }, SETTLE_AFTER);
    return () => clearTimeout(id);
  }, [isTop, skip]);

  return { state, shimmer };
}
