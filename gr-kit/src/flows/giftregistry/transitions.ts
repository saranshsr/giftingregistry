import { registerTransition } from '../../motion/transitions';
import { appleSpring } from '../../motion/presets';
import { MOVE } from './motion';

/**
 * The page underneath a cover that only dims must name its resting transform: motion/react sends a value that drops out
 * of the target back to its `initial` (here `gr-push`'s x 100%), so a filter-only `under` slid My Lists off to the right.
 */
const STILL = { x: 0, y: 0, scale: 1 };

/**
 * Gift Registry screen transitions (registered on import, see index.ts). All ride the MOVE spring; the page underneath
 * darkens 12% as in the reference (`--dim` 0.12), with the kit `underDim` black layer (an opacity change, not a filter).
 *
 * - `gr-push`: Account → My Lists. Page in from the right, the one below drifts 30% left.
 * - `gr-flow`: the creation steps as a modal; closing drops it (translateY 100%) and the page below brightens.
 * - `gr-morph`: the explainer card grows into step 1. Its start rect is the card's measured box, registered right
 *   before the navigation (`registerMorph`).
 */
registerTransition('gr-push', {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
  under: { x: '-30%' },
  underDim: 0.12,
  transition: MOVE,
});

registerTransition('gr-flow', {
  initial: { y: '100%' },
  animate: { y: 0 },
  exit: { y: '100%' },
  under: STILL,
  underDim: 0.12,
  transition: MOVE,
});

/**
 * `gr-reveal`: Create → the registry page, a calm hand-off with no splash. The screen itself doesn't move: the Delivery
 * step has already faded its content out over its themed background, and the registry page paints that same background
 * under itself and cross-fades its own backdrop, header and body in over it (RegistryScreen, `from: 'create'`).
 * Leaving it slides it away to the right like a pop, uncovering My Lists.
 */
registerTransition('gr-reveal', {
  initial: { x: 0 },
  animate: { x: 0 },
  exit: { x: '100%' },
  under: STILL,
  underDim: 0.12,
  transition: MOVE,
});

/** inset of the card inside the phone screen, px from each edge, and its corner radius */
export interface MorphRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  radius: number;
}

const full = 'inset(0px 0px 0px 0px round 0px)';
export function registerMorph(r: MorphRect) {
  registerTransition('gr-morph', {
    initial: { clipPath: `inset(${r.top}px ${r.right}px ${r.bottom}px ${r.left}px round ${r.radius}px)` },
    animate: { clipPath: full },
    exit: { y: '100%', clipPath: full },
    under: STILL,
    underDim: 0.12,
    // the one surface that travels the whole screen: a calmer, critically damped spring (response 0.5 s) so the
    // card visibly grows instead of snapping open; everything else rides MOVE
    transition: appleSpring(0.5, 1),
  });
}
// a sane default until a card has been measured (e.g. the steps opened straight from the URL)
registerMorph({ top: 290, right: 12, bottom: 34, left: 12, radius: 16 });
