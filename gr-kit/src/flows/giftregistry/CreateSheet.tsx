import type { DotLottie } from '@lottiefiles/dotlottie-react';
import { AnimatePresence, animate, motion, type Transition } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { easing } from '../../motion/presets';
import { Lottie, OriginIcon, Pressable, SheetBody } from '../../components';
import { NanoButton } from './components/NanoButton';
import { NewTag } from './components/NewTag';
import { haptics } from './haptics';
import { useNav } from '../../kit/Navigator';
import { useReduceMotion } from '../../motion/reducedMotion';
import { heroLottie, warmLottie } from './assets';
import { copy } from './data';
import { arrive, fade, leave, MOVE, STAGGER_OUT } from './motion';
import { resetAnswers } from './store';
import { decodeSoon } from './warm';
import { registerMorph } from './transitions';
import colGlow from '@assets/giftregistry/create/col-glow.svg?url';
import regGlow from '@assets/giftregistry/create/reg-glow.svg?url';
import colLottie from '@assets/giftregistry/lottie/gr-sheet-collection.lottie?url';
import regLottie from '@assets/giftregistry/lottie/gr-sheet-registry.lottie?url';
import ftuxLottie from '@assets/giftregistry/lottie/gr-ftux-explainer.lottie?url';
import stepBg from '@assets/giftregistry/themes/bg-default.jpg';
import styles from './CreateSheet.module.css';

/**
 * 03 Create sheet → "What is a Gift Registry" (kit Origin bottom sheet: grabber above, 12 inset, r16).
 * Cards: Figma "0.3 Create · bottom sheet" 843:755739 (Collection Drawer 843:756638, cards 845:195263 / 845:195276).
 * Their art pops in layer by layer as the sheet settles (reference buildSheetCard choreography); tapping "Create your
 * gift registry" grows the same sheet into the explainer in place (reference expandCreateSheet), and its Continue
 * grows the white card into step 1 (reference morphToRegistry, here the `gr-morph` transition).
 */
type Piece = { src: string; x: number; y: number; w: number; h: number; at: number; kind: 'glow' | 'cloud'; opacity?: number; rotate?: number };
/**
 * Figma "Visuals" layers (pt in the 200 × 120 box pinned to the card's top-right corner) and when each pops, ms after
 * the sheet starts rising. Reference order glow → cloud → object → sparkles; one 60 ms stagger per card, the
 * registry card 60 behind the collection card. The gift art is Figma's layer as drawn: the image stretched to fill
 * 151.6 × 101.1 and turned 1.98°, centred in its 155.0 × 106.3 rotated box at (54, 8.88).
 */
const CARDS: Record<'collection' | 'registry', Piece[]> = {
  collection: [
    { src: colGlow, x: 32, y: -50, w: 220, h: 220, at: 0, kind: 'glow' },
  ],
  registry: [
    { src: regGlow, x: 27, y: -42, w: 220, h: 220, at: 60, kind: 'glow' },
  ],
};

/**
 * The illustration itself (object + sparkles) is a lottie per card: sheet-illos/export, AE comps "GR sheet · …",
 * 600 × 360 = the 200 × 120 Visuals box at 3x, transparent; cloud, object and sparkles are in it, only the radial glow
 * stays code. Markers: "intro" plays once from `at` (ms after the sheet starts rising, so it is landing with the sheet),
 * then "idle" loops seamlessly.
 */
const ILLO: Record<keyof typeof CARDS, { src: string; at: number; idleShare: number }> = {
  collection: { src: colLottie, at: 0, idleShare: 66 / 275 },
  registry: { src: regLottie, at: 60, idleShare: 70 / 279 },
};

/**
 * The reward pop: MOVE's stiffness (same tempo) with less damping (ζ 0.64), so a piece swells ~4% past rest and
 * settles once. Reference: keyframes to 1.1 / −3 px / 2° at 60%, 560 ms cubic-bezier(.3,.7,.4,1). Only the
 * illustrations and the explainer numbers use it; everything else is MOVE.
 */
const POP: Transition = { type: 'spring', stiffness: 300, damping: 22, mass: 1 };
const pop = (delay: number, fadeS = 0.2): Transition => ({ ...POP, delay, opacity: { duration: fadeS, delay, ease: easing.out } });

/** one sweep across the registry title once its art has landed (reference: sweep 1000 ms @1000) */
const SHIMMER = { delay: 0.86, duration: 0.9 };
/**
 * Figma 843:755739 has no NEW tag on the registry card, so it is off. The reference popped one as the sweep left the
 * title (420 ms @1950); set true to bring it back at TAG_AT.
 */
const SHOW_NEW_TAG = false;
const TAG_AT = 1.46;

/** Figma drawer card 843:756642: 12 + 120 + 12 + 120 + 12 */
const CARDS_H = 276;
/**
 * FTUX lottie (ftux/export, AE "GR FTUX · What is a Gift Registry"): everything on the explainer but the CTA, 1053 × 1252
 * = Figma card 843:763418's 351 × 417.33 pt at 3x, scaled to the sheet's width. Markers: "intro" f0–90, "idle" f90–330.
 * The CTA (dev-built) sits right under it, as in Figma (top 417.45 of 481.45: 64 pt to the card's bottom).
 */
const FTUX_RATIO = 1252 / 1053;
const FTUX_IDLE = 90 / 329;
const CTA_BAND = 481.45 - 417.33;
const explainerH = (w: number) => Math.round(w * FTUX_RATIO + CTA_BAND);
/** card press (reference .tap:active: scale .97 + brightness .97, 180 ms), on the kit press spring */
const CARD_PRESS = { scale: 0.97, filter: 'brightness(0.97)' };

export function CreateSheet() {
  const nav = useNav();
  const [mode, setMode] = useState<'cards' | 'explainer'>('cards');
  // the explainer's height follows the sheet's width (the FTUX lottie scales to it)
  const panel = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(351);
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    setW(el.offsetWidth || 351);
    const ro = new ResizeObserver(() => setW(el.offsetWidth || 351));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <SheetBody inset={false} className={styles.body}>
      <motion.div ref={panel} className={styles.panel} initial={false} animate={{ height: mode === 'cards' ? CARDS_H : explainerH(w) }} transition={MOVE}>
        {/* no initial={false} here: it would reach every motion child of the cards and skip the art's pop-in */}
        <AnimatePresence>
          {mode === 'cards' ? (
            <motion.div key="cards" className={styles.cards} exit={{ opacity: 0, y: 10, scale: 0.97, transition: leave() }}>
              <SheetCard kind="collection" title={copy.create.collection.title} sub={copy.create.collection.sub} onPress={() => nav.toast(copy.create.collectionToast)} />
              <SheetCard kind="registry" title={copy.create.registry.title} sub={copy.create.registry.sub} shimmer onPress={() => (haptics.lift(), setMode('explainer'))} />
            </motion.div>
          ) : (
            <Explainer key="explainer" ftuxH={w * FTUX_RATIO} />
          )}
        </AnimatePresence>
      </motion.div>
    </SheetBody>
  );
}

/** Figma "Empty state landscape": 120 tall, bg-subtle, r12, p16; B16 title, Label3 subtitle, 28 pt "+" chip */
function SheetCard({ kind, title, sub, shimmer, onPress }: { kind: keyof typeof CARDS; title: string; sub: string; shimmer?: boolean; onPress: () => void }) {
  const reduce = useReduceMotion();
  return (
    <Pressable className={styles.card} scale={CARD_PRESS.scale} whileTap={CARD_PRESS} onClick={onPress} aria-label={title}>
      <span className={styles.visuals} aria-hidden>
        {CARDS[kind].map((p, i) => {
          const d = p.at / 1000;
          const to = p.opacity ?? 1;
          const rest = p.rotate ?? 0;
          // the radial glow blooms here; cloud, object and sparkles are the card's lottie (SheetIllo)
          const from =
            p.kind === 'glow'
              ? { opacity: 0, scale: 0.6 }
              : { opacity: 0, scale: 0.8, y: 8 };
          return (
            <motion.img
              key={i}
              src={p.src}
              alt=""
              className={[styles.piece, p.kind === 'cloud' && styles.cloud].filter(Boolean).join(' ')}
              style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
              initial={reduce ? false : from}
              animate={{ opacity: to, scale: 1, y: 0, rotate: rest }}
              transition={{ ...MOVE, delay: d, opacity: { duration: 0.5, delay: d, ease: easing.out } }}
            />
          );
        })}
        <SheetIllo {...ILLO[kind]} />
      </span>
      <span className={styles.cardTitle}>
        <span className={styles.titleText}>
          {title}
          {shimmer && !reduce && (
            <motion.span
              className={styles.shimmer}
              aria-hidden
              initial={{ backgroundPosition: '100% 0' }}
              animate={{ backgroundPosition: '0% 0' }}
              transition={{ ...SHIMMER, ease: easing.inOut }}
            >
              {title}
            </motion.span>
          )}
        </span>
        {shimmer && SHOW_NEW_TAG && (
          <motion.span className={styles.tag} initial={reduce ? false : { opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={pop(TAG_AT, 0.16)}>
            <NewTag>{copy.create.newTag}</NewTag>
          </motion.span>
        )}
      </span>
      <span className={styles.cardSub}>{sub}</span>
      <span className={styles.plus}>
        <OriginIcon name="plus" size={20} color="var(--nk-color-text-primary)" />
      </span>
    </Pressable>
  );
}

/** plays the card's lottie: "intro" once after `at`, then loops "idle"; reduced motion holds the intro's last frame */
function SheetIllo({ src, at, idleShare, maxDpr = 3 }: { src: string; at: number; idleShare: number; maxDpr?: number }) {
  const reduce = useReduceMotion();
  const player = useRef<DotLottie | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedAt = useRef(performance.now());
  useEffect(() => () => clearTimeout(timer.current), []);
  const onPlayer = (d: DotLottie) => {
    if (reduce || player.current === d) return;
    player.current = d;
    const start = () => {
      d.setMarker('intro');
      const idle = () => {
        d.removeEventListener('complete', idle);
        d.setMarker('idle');
        d.setLoop(true);
        d.play();
      };
      d.addEventListener('complete', idle);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => d.play(), Math.max(0, at - (performance.now() - mountedAt.current)));
    };
    if (d.isLoaded) start();
    else d.addEventListener('load', start);
  };
  return <Lottie src={src} autoplay={reduce} reducedMotionFrame={idleShare} onPlayer={onPlayer} maxDpr={maxDpr} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

/** "What is a Gift Registry" (Figma v2 sheet 843:763414): the FTUX lottie (hero, rays, three columns), then Continue */
function Explainer({ ftuxH }: { ftuxH: number }) {
  const nav = useNav();
  const reduce = useReduceMotion();
  const root = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    nav.preload('giftregistry/steps');
    // the morph's landing art, fetched and decoded before Continue: step 1's hero and its themed background
    warmLottie(heroLottie('occ', null));
    decodeSoon([stepBg], 2000);
  }, []);

  // the content starts while the panel is still growing (reference: +260 ms, once its cards had gone); the CTA rises
  // as the lottie's last column lands (its f0–90 intro: columns at 0.20 / 0.26 / 0.32 s, dividers drawn by ~0.7 s)
  const t0 = 0.18;
  const ctaAt = t0 + 0.5;

  const onContinue = () => {
    if (leaving) return;
    // the press / release haptics are NanoButton's own (touch-down / touch-up)
    setLeaving(true);
    resetAnswers();
    // the card's box inside the phone screen: the step grows out of exactly this rect
    const el = root.current;
    const layer = el?.closest('[data-sheet]')?.parentElement;
    const surface = el?.closest('[data-sheet]')?.lastElementChild as HTMLElement | null;
    if (el && layer && surface) {
      const L = layer.getBoundingClientRect(),
        C = surface.getBoundingClientRect();
      const k = L.width / layer.offsetWidth || 1; // the preview may scale the phone
      registerMorph({ top: (C.top - L.top) / k, right: (L.right - C.right) / k, bottom: (L.bottom - C.bottom) / k, left: (C.left - L.left) / k, radius: 16 });
    }
    // the lottie fades and the button steps aside while the card grows (reference: y14, 220 ms + i × 12)
    if (el && !reduce) {
      el.querySelectorAll<HTMLElement>('[data-fade]').forEach((n) => animate(n, { opacity: 0 }, leave()));
      el.querySelectorAll<HTMLElement>('[data-away]').forEach((n, i) => animate(n, { opacity: 0, y: 14 }, leave(i * (STAGGER_OUT / 3))));
    }
    nav.replace('giftregistry/steps', { morph: '1' }, { presentation: 'modal', transition: 'gr-morph' });
  };

  return (
    <motion.div ref={root} className={styles.explainer} initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: fade(0.15) }}>
      <div data-fade className={styles.ftux} style={{ height: ftuxH }}>
        <SheetIllo src={ftuxLottie} at={t0 * 1000} idleShare={FTUX_IDLE} maxDpr={2} />
      </div>
      {/* CTA (dev-built) rises last (reference y16, 480 ms): Figma's "nano button · Continue" (843:763470) = nano Button v3
          primary, the guide's neutral black (no occasion is picked yet); 12 pt below the lottie's bottom edge */}
      <motion.div
        data-away
        className={styles.cta}
        style={{ top: ftuxH + 0.12 }}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={arrive(ctaAt, 0.28)}
      >
        <NanoButton variant="primary" onClick={onContinue}>
          {copy.explainer.cta}
        </NanoButton>
      </motion.div>
    </motion.div>
  );
}
