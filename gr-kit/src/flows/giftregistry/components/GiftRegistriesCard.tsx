import { motion, type TargetAndTransition, type Transition } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable } from '../../../components';
import { haptics } from '../haptics';
import { NewTag } from './NewTag';
import { useNav } from '../../../kit/Navigator';
import { art } from '../assets';
import { copy } from '../data';
import { arrive, fade, MOVE, STAGGER_IN, STAGGER_OUT } from '../motion';
import { TitleShimmer } from './intro/TitleShimmer';
import { useCardIntro, type IntroState } from './intro/useCardIntro';
import styles from './GiftRegistriesCard.module.css';

/**
 * The Account page's "My Lists" card with its Gift Registries teaser (reference prototype flow 6:
 * assets/mylists/widget.js, Figma Component 225 states 01–05). Shell = the kit Account action card (white, r12, title
 * in the action-title style); the art is the reference's layers, placed in pt inside the 169.5 × 136 card.
 *
 * 01 My Lists, thumbnails fanned → 02 thumbnails gather → 03 the promo rises (Gift Registries copy, NEW, one shimmer)
 * → 04 the promo drops away → 05 the thumbnails fan back out. Runs once per load of the flow (intro/useCardIntro);
 * reduced motion and later visits rest on 05. The card stays tappable throughout: a tap mid-intro opens My Lists.
 */
const STATES: Record<IntroState, { gift: boolean; badge: boolean; fan: boolean; thumbs: boolean }> = {
  s01: { gift: false, badge: false, fan: true, thumbs: true },
  s02: { gift: false, badge: false, fan: false, thumbs: true },
  s03: { gift: true, badge: true, fan: false, thumbs: false },
  s04: { gift: false, badge: true, fan: false, thumbs: true },
  s05: { gift: false, badge: true, fan: true, thumbs: true },
};

/** promo layers at their state-03 places; `hide` parks them just below the card; `lag` staggers the rise (ms) */
const PROMO = [
  { name: 'glow-1', x: -27, y: 38, w: 145, h: 144, hide: { x: -0.68, y: 107.24, s: 0.618 }, lag: 0 },
  { name: 'glow-2', x: 52, y: -2, w: 220, h: 220, hide: { x: -45.16, y: 108, s: 0.618 }, lag: 20 },
  { name: 'palm', x: 64.75, y: 47.8, w: 101.5, h: 139, hide: { x: 0, y: 110, s: 0.85 }, lag: 50 },
  { name: 'lamp', x: 96, y: 48, w: 74, h: 104.5, hide: { x: 0, y: 108, s: 0.8 }, lag: 80 },
  { name: 'obj-a-green', x: 17, y: 55.5, w: 93, h: 93.5, hide: { x: 0, y: 104, s: 0.8 }, lag: 140 },
  { name: 'obj-b', x: 5, y: 83, w: 91, h: 103, hide: { x: 0, y: 74, s: 0.8 }, lag: 110 },
  { name: 'obj-c', x: 65.5, y: 81, w: 69, h: 69.5, hide: { x: 0, y: 76, s: 0.8 }, lag: 170 },
];
const THUMB = { w: 49.5, h: 65.5, x: 31.625, y: 91.5 };
const FAN = [
  { x: 33.88, y: 93.12, r: -4 },
  { x: 73.25, y: 91.62, r: 0 },
  { x: 111.62, y: 92.25, r: 2 },
  { x: 150.88, y: 92.25, r: -2 },
  { x: 189.24, y: 91.5, r: 0 },
];
const ms = (n: number) => n / 1000;
/** thumbnails fan out left → right on the kit's in-stagger, gather right → left on its out-stagger (s) */
const FAN_IN = STAGGER_IN;
const FAN_OUT = STAGGER_OUT;
const ART = [...PROMO.map((p) => art(`mylists/${p.name}.png`)), ...FAN.map((_, i) => art(`mylists/thumb-${i + 1}.png`))];

export function GiftRegistriesCard() {
  const nav = useNav();
  const { state, shimmer } = useCardIntro(ART);
  const prev = useRef<IntroState>(state);
  const titles = useRef<{ my?: HTMLSpanElement | null; gift?: HTMLSpanElement | null }>({});
  const [widths, setWidths] = useState({ my: 62, gift: 118 });

  // the NEW badge sits 6 after whichever title shows; measure the live titles (and again once the web font lands,
  // or the badge would sit on top of the last letters)
  useLayoutEffect(() => {
    const my = titles.current.my,
      gift = titles.current.gift;
    if (!my || !gift) return;
    const measure = () => {
      if (my.offsetWidth && gift.offsetWidth) setWidths({ my: my.offsetWidth, gift: gift.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(my);
    ro.observe(gift);
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, []);

  const st = STATES[state];
  const was = STATES[prev.current];
  useEffect(() => {
    prev.current = state;
  }, [state]);
  const promoIn = st.gift && !was.gift;
  const promoOut = !st.gift && was.gift;
  const flow = promoIn ? 1 : -1;
  const textSwap = st.gift !== was.gift;

  const promoT = (lag: number): Transition => (promoIn ? { ...MOVE, delay: ms(lag * 0.6) } : promoOut ? { ...MOVE, delay: ms((170 - lag) * 0.25) } : MOVE);

  // copy slides with the flow: the outgoing line leaves in the flow direction, the incoming arrives from the other side.
  // Both share one spot, so the outgoing fade is short and front-loaded (ease-out) and the incoming one waits a beat:
  // the two lines hand over instead of smearing into each other.
  const textAnim = (show: boolean): TargetAndTransition =>
    show
      ? { opacity: 1, y: 0, transition: textSwap ? arrive(0.08, 0.3) : { duration: 0 } }
      : { opacity: 0, y: -11 * flow, transition: textSwap ? { ...MOVE, opacity: fade(0.14) } : { duration: 0 } };
  const textInitial = (show: boolean) => (show ? { opacity: 1, y: 0 } : { opacity: 0, y: 11 });

  const badgeX = (st.gift ? widths.gift : widths.my) + 6; // Figma: 6 after the title
  const fanChange = st.fan !== was.fan;
  const hiding = !st.thumbs && was.thumbs;
  const showing = st.thumbs && !was.thumbs;

  return (
    <Pressable
      className={styles.card}
      scale={0.98}
      onClick={() => (haptics.lift(), nav.push('giftregistry/lists', {}, { transition: 'gr-push' }))}
      aria-label={st.gift ? copy.account.registries : copy.account.myLists}
    >
      {PROMO.map((p) => (
        <motion.img
          key={p.name}
          className={styles.layer}
          src={art(`mylists/${p.name}.png`)}
          alt=""
          style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
          initial={{ x: p.hide.x, y: p.hide.y, scale: p.hide.s }}
          animate={st.gift ? { x: 0, y: 0, scale: 1 } : { x: p.hide.x, y: p.hide.y, scale: p.hide.s }}
          transition={promoT(p.lag)}
        />
      ))}

      {/* thumbnails: first on top, so they are drawn last → first */}
      {[...FAN].reverse().map((f, ri) => {
        const i = FAN.length - 1 - ri;
        const pos = st.fan ? { x: f.x - THUMB.x, y: f.y - THUMB.y, rotate: f.r } : { x: 0, y: 0, rotate: 0 };
        const away = st.thumbs ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92, y: pos.y - 22 };
        const t: Transition = fanChange
          ? { ...MOVE, delay: st.fan ? i * FAN_IN : (4 - i) * FAN_OUT, opacity: fade(0.24) }
          : hiding
            ? { ...MOVE, opacity: fade(0.32, 0.04) }
            : showing
              ? { ...MOVE, delay: 0.14, opacity: fade(0.32, 0.14) }
              : MOVE;
        return (
          <motion.img
            key={i}
            className={`${styles.layer} ${styles.thumb}`}
            src={art(`mylists/thumb-${i + 1}.png`)}
            alt=""
            style={{ left: THUMB.x - THUMB.w / 2, top: THUMB.y - THUMB.h / 2, width: THUMB.w, height: THUMB.h }}
            initial={false}
            animate={{ ...pos, ...away }}
            transition={t}
          />
        );
      })}

      <span className={styles.copy}>
        <motion.span ref={(el) => void (titles.current.my = el)} className={styles.title} initial={textInitial(!st.gift)} animate={textAnim(!st.gift)}>
          {copy.account.myLists}
        </motion.span>
        <motion.span ref={(el) => void (titles.current.gift = el)} className={styles.title} initial={textInitial(st.gift)} animate={textAnim(st.gift)}>
          {copy.account.registries}
          <TitleShimmer run={shimmer}>{copy.account.registries}</TitleShimmer>
        </motion.span>
        <motion.span className={styles.sub} initial={textInitial(!st.gift)} animate={textAnim(!st.gift)}>
          {copy.account.myListsSub}
        </motion.span>
        <motion.span className={styles.sub} initial={textInitial(st.gift)} animate={textAnim(st.gift)}>
          {copy.account.registriesSub}
        </motion.span>
        {/* NEW: appears in place beside "Gift Registries" (fade + .92 → 1, no slide while it is still invisible),
            then glides back with the narrower "My Lists" title */}
        <motion.span
          className={styles.badge}
          initial={{ opacity: st.badge ? 1 : 0, scale: st.badge ? 1 : 0.92, x: badgeX }}
          animate={{ opacity: st.badge ? 1 : 0, scale: st.badge ? 1 : 0.92, x: badgeX }}
          transition={st.badge && !was.badge ? { ...MOVE, delay: 0.2, opacity: fade(0.32, 0.2), x: { duration: 0 } } : { ...MOVE, delay: textSwap ? 0.08 : 0 }}
        >
          <NewTag>{copy.account.newTag}</NewTag>
        </motion.span>
      </span>
    </Pressable>
  );
}
