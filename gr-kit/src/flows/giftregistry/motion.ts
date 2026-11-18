import type { Transition } from 'motion/react';
import { easing, fieldMotion, handoff } from '../../motion/presets';

/**
 * The flow's motion, on the kit system (noon motion standard): one MOVE spring for anything that moves
 * (Spring 300 / 28 = `fieldMotion.spring.springLight`, ζ 0.81: settles without a visible bounce), fades on
 * ease-out cubic (`easing.out`), stagger 60 in / 40 out (`handoff.stagger`). Choreography (what moves, in what
 * order) follows the reference prototype; its one-off curves and long holds are tightened (see MAPPING.md).
 */
export const MOVE: Transition = fieldMotion.spring.springLight;
/** every bottom sheet's opening in this flow (Create, address, the date-picker stand-in): spring (300, 28, 1) */
export const SHEET_OPEN: Transition = { type: 'spring', stiffness: 300, damping: 28, mass: 1 };
export const fade = (duration = 0.24, delay = 0): Transition => ({ duration, delay, ease: easing.out });
export const fadeOut = (duration = 0.18, delay = 0): Transition => ({ duration, delay, ease: easing.in });
export const move = (delay = 0): Transition => ({ ...MOVE, delay });
export const STAGGER_IN = handoff.stagger.in;
export const STAGGER_OUT = handoff.stagger.out;
/** move + its own fade, the common "arrive" pairing */
export const arrive = (delay = 0, fadeS = 0.28): Transition => ({ ...MOVE, delay, opacity: { duration: fadeS, delay, ease: easing.out } });
/** leaving: a short fade with the move */
export const leave = (delay = 0): Transition => ({ ...MOVE, delay, opacity: { duration: 0.16, delay, ease: easing.in } });

/** CSS strings for the few CSS-driven state changes (tile selection, colour cross-fades) */
export const css = {
  out: `cubic-bezier(${easing.out.join(', ')})`,
  in: `cubic-bezier(${easing.in.join(', ')})`,
};
