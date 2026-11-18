import type { DotLottie } from '@lottiefiles/dotlottie-react';
import { AnimatePresence, animate, motion, type Transition } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { easing } from '../../motion/presets';
import { Lottie, OriginIcon, Pressable, SheetBody } from '../../components';
import { NanoButton } from './components/NanoButton';
import { NewTag } from './components/NewTag';
import { haptics } from './haptics';
import { useNav } from '../../kit/Navigator';
import { useReduceMotion } from '../../motion/reducedMotion';
import { art, explainerHero, heroLottie, warmLottie } from './assets';
import { copy } from './data';
import { arrive, fade, leave, MOVE, STAGGER_IN, STAGGER_OUT } from './motion';
import { resetAnswers } from './store';
import { decodeSoon } from './warm';
import { registerMorph } from './transitions';
import colGlow from '@assets/giftregistry/create/col-glow.svg?url';
import regGlow from '@assets/giftregistry/create/reg-glow.svg?url';
import cloud from '@assets/giftregistry/create/cloud.png';
import colArt from '@assets/giftregistry/create/col-art.png';
import regArt from '@assets/giftregistry/create/reg-art.png';
import sparkle from '@assets/giftregistry/create/sparkle.png';
// a copy of the Figma export with its baked dark top corners filled with the blue, so the sheet's own r16 clip is the
// only corner (the original export showed a dark crescent inside the card's curve)
import heroBg from '@assets/giftregistry/create/hero-bg-full.jpg';
import stepBg from '@assets/giftregistry/themes/bg-default.jpg';
import styles from './CreateSheet.module.css';

/**
 * 03 Create sheet → "What is a Gift Registry" (kit Origin bottom sheet: grabber above, 12 inset, r16).
 * Cards: Figma "0.3 Create · bottom sheet" 843:755739 (Collection Drawer 843:756638, cards 845:195263 / 845:195276).
 * Their art pops in layer by layer as the sheet settles (reference buildSheetCard choreography); tapping "Create your
 * gift registry" grows the same sheet into the explainer in place (reference expandCreateSheet), and its Continue
 * grows the white card into step 1 (reference morphToRegistry, here the `gr-morph` transition).
 */
type Piece = { src: string; x: number; y: number; w: number; h: number; at: number; kind: 'glow' | 'cloud' | 'art' | 'sparkle'; opacity?: number; rotate?: number };
/**
 * Figma "Visuals" layers (pt in the 200 × 120 box pinned to the card's top-right corner) and when each pops, ms after
 * the sheet starts rising. Reference order glow → cloud → object → sparkles; one 60 ms stagger per card, the
 * registry card 60 behind the collection card. The gift art is Figma's layer as drawn: the image stretched to fill
 * 151.6 × 101.1 and turned 1.98°, centred in its 155.0 × 106.3 rotated box at (54, 8.88).
 */
const CARDS: Record<'collection' | 'registry', Piece[]> = {
  collection: [
    { src: colGlow, x: 32, y: -50, w: 220, h: 220, at: 160, kind: 'glow' },
    { src: cloud, x: 86, y: 46, w: 140, h: 103, at: 200, kind: 'cloud', opacity: 0.55 },
    { src: colArt, x: 53, y: 12, w: 143, h: 95, at: 260, kind: 'art' },
  ],
  registry: [
    { src: regGlow, x: 27, y: -42, w: 220, h: 220, at: 220, kind: 'glow' },
    { src: cloud, x: 87, y: 44, w: 140, h: 103, at: 260, kind: 'cloud', opacity: 0.55 },
    { src: regArt, x: 55.7, y: 11.47, w: 151.61, h: 101.08, at: 320, kind: 'art', rotate: 1.98 },
    { src: sparkle, x: 87, y: 14, w: 16, h: 16, at: 440, kind: 'sparkle', opacity: 0.9 },
    { src: sparkle, x: 171, y: 12, w: 11, h: 11, at: 500, kind: 'sparkle', opacity: 0.7 },
  ],
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
/** Figma explainer card 843:763418: 481.45 */
const EXPLAINER_H = 482;
/** card press (reference .tap:active: scale .97 + brightness .97, 180 ms), on the kit press spring */
const CARD_PRESS = { scale: 0.97, filter: 'brightness(0.97)' };

export function CreateSheet() {
  const nav = useNav();
  const [mode, setMode] = useState<'cards' | 'explainer'>('cards');
  return (
    <SheetBody inset={false} className={styles.body}>
      <motion.div className={styles.panel} initial={false} animate={{ height: mode === 'cards' ? CARDS_H : EXPLAINER_H }} transition={MOVE}>
        {/* no initial={false} here: it would reach every motion child of the cards and skip the art's pop-in */}
        <AnimatePresence>
          {mode === 'cards' ? (
            <motion.div key="cards" className={styles.cards} exit={{ opacity: 0, y: 10, scale: 0.97, transition: leave() }}>
              <SheetCard kind="collection" title={copy.create.collection.title} sub={copy.create.collection.sub} onPress={() => nav.toast(copy.create.collectionToast)} />
              <SheetCard kind="registry" title={copy.create.registry.title} sub={copy.create.registry.sub} shimmer onPress={() => (haptics.lift(), setMode('explainer'))} />
            </motion.div>
          ) : (
            <Explainer key="explainer" />
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
          // reference: glow .6 → 1; objects .5 / y14 / −6°; sparkles 0 / −90°. Objects start a touch fuller (.6 /
          // y12) and sparkles turn a quarter less, so the pop reads as a settle rather than a bounce
          const from =
            p.kind === 'glow'
              ? { opacity: 0, scale: 0.6 }
              : p.kind === 'sparkle'
                ? { opacity: 0, scale: 0, rotate: -60 }
                : p.kind === 'cloud'
                  ? { opacity: 0, scale: 0.8, y: 8 }
                  : { opacity: 0, scale: 0.6, y: 12, rotate: rest - 6 };
          return (
            <motion.img
              key={i}
              src={p.src}
              alt=""
              className={[styles.piece, p.kind === 'cloud' && styles.cloud].filter(Boolean).join(' ')}
              style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
              initial={reduce ? false : from}
              animate={{ opacity: to, scale: 1, y: 0, rotate: rest }}
              // the glow and cloud bloom (MOVE + a long ease-out fade, reference 600 ms); the object and sparkles pop
              transition={p.kind === 'glow' || p.kind === 'cloud' ? { ...MOVE, delay: d, opacity: { duration: 0.5, delay: d, ease: easing.out } } : pop(d)}
            />
          );
        })}
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

/** "What is a Gift Registry" (Figma v2 sheet 843:763414): hero lottie over its background, three columns, Continue */
function Explainer() {
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

  // the content starts while the panel is still growing (reference: +260 ms, once its cards had gone)
  const t0 = 0.18;
  // each column: number + icon pop, text slides in +50, divider +120 (reference: numbers at 460 + i × 110 after t0;
  // here 200 + i × 60, the kit's stagger, so the three columns read as one beat)
  const col = (i: number) => t0 + 0.2 + i * STAGGER_IN;
  const ctaAt = col(2) + 0.18; // after the last divider (reference: 820 after t0)
  // the hero lottie (art, arc and title in one) starts with the content, not on mount behind the outgoing cards
  const player = useRef<DotLottie | null>(null);
  const playTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedAt = useRef(performance.now());
  useEffect(() => () => clearTimeout(playTimer.current), []);
  const onPlayer = (d: DotLottie) => {
    if (reduce || player.current === d) return;
    player.current = d;
    const start = () => {
      clearTimeout(playTimer.current);
      playTimer.current = setTimeout(() => d.play(), Math.max(0, t0 * 1000 - (performance.now() - mountedAt.current)));
    };
    if (d.isLoaded) start();
    else d.addEventListener('load', start);
  };

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
    // rows and the button step aside while the card grows (reference: y14, 220 ms + i × 12)
    if (el && !reduce) el.querySelectorAll<HTMLElement>('[data-away]').forEach((n, i) => animate(n, { opacity: 0, y: 14 }, leave(i * (STAGGER_OUT / 3))));
    nav.replace('giftregistry/steps', { morph: '1' }, { presentation: 'modal', transition: 'gr-morph' });
  };

  const enter = (from: Record<string, number>, transition: Transition) => ({
    initial: reduce ? false : { opacity: 0, ...from },
    animate: { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, scaleY: 1 },
    transition,
  });
  const rise = (delay: number, from: Record<string, number>) => enter(from, arrive(delay, 0.28));

  return (
    <motion.div ref={root} className={styles.explainer} initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: fade(0.15) }}>
      {/* Figma 843:763419: a 206-tall hero that clips the 375 × 235 Onboarding background (843:763446), centred on
          the card; the lottie (art, arc and title, AE comp 351 × 206) sits centred on top, as in the v2 proto */}
      <div className={styles.hero}>
        <motion.img className={styles.heroBg} src={heroBg} alt="" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={fade(0.42, t0)} />
        <div className={styles.heroLottie}>
          {/* reduced motion: autoplay lets the kit Lottie hold its representative frame */}
          <Lottie src={explainerHero} autoplay={reduce} onPlayer={onPlayer} worker maxDpr={2} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
      {copy.explainer.cols.map((c, i) => (
        <div key={i} className={styles.col} style={{ left: `calc(${i} * 100% / 3)` }}>
          {/* icon and number pop together (reference: number .4 / −10° → 1.12 / 3° → 1, 520 ms) */}
          <motion.img data-away className={styles.ico} src={art(`explainer/ico${i + 1}.png`)} alt="" {...enter({ scale: 0.7, y: 6 }, pop(col(i)))} />
          <motion.img
            data-away
            className={styles.num}
            data-n={i + 1}
            src={art(`explainer/num${i + 1}.png`)}
            alt={`0${i + 1}`}
            {...enter({ scale: 0.5, rotate: -8 }, pop(col(i) + 0.03))}
          />
          {/* text slides in from the right (reference x18, 440 ms ease-out @+50) */}
          <motion.p data-away className={styles.txt} {...rise(col(i) + 0.05, { x: 14 })}>
            {c.lead}
            <b>{c.bold}</b>
            {c.tail}
          </motion.p>
          {/* divider draws down from the top (reference: scale from .6, 380 ms @+120) */}
          {i < 2 && <motion.span data-away className={styles.divider} style={{ originY: 0 }} {...rise(col(i) + 0.12, { scaleY: 0.6 })} />}
        </div>
      ))}
      {/* CTA rises last (reference y16, 480 ms): Figma's "nano button · Continue" (843:763470) = nano Button v3 primary,
          the guide's neutral black (no occasion is picked yet) */}
      <motion.div data-away className={styles.cta} {...rise(ctaAt, { y: 16 })}>
        <NanoButton variant="primary" onClick={onContinue}>
          {copy.explainer.cta}
        </NanoButton>
      </motion.div>
    </motion.div>
  );
}
