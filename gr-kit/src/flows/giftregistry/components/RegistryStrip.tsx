import { animate, motion } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import { Pressable } from '../../../components';
import { useNav } from '../../../kit/Navigator';
import { useReduceMotion } from '../../../motion/reducedMotion';
import { appleSpring, easing } from '../../../motion/presets';

/**
 * The strip's own, softer motion (both the landing reveal and a new registry riding in): a critically damped spring
 * (response 0.75 s, no overshoot) for the glide, 55 ms apart, and the arriving card settling on the same spring with a
 * 450 ms ease-out fade. About 1.3 s in all, calm and unhurried.
 */
const SOFT = appleSpring(0.75, 1);
const STAGGER = 0.055;
const settle = (delay: number) => ({ ...SOFT, delay, opacity: { duration: 0.45, delay, ease: easing.out } });
import { listCards, newRegistryCard } from '../products';
import type { OccasionKey } from '../tokens';

const trays = import.meta.glob('../../../assets/giftregistry/themes/tray-*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const trayArt = (k: OccasionKey) => trays[`../../../assets/giftregistry/themes/tray-${k === 'mothersday' ? 'birthday' : k}.png`];
import { grStore, type Registry } from '../store';
import { giftregistryTokens } from '../tokens';
import { haptics } from '../haptics';
import styles from './RegistryStrip.module.css';

/**
 * The My Lists collections strip as the reference draws it (flow 6, wishlist strip): registries made in this session
 * (newest first, the occasion's card from Figma 8480:637793 with its icon and tag), the "Gift registry" card, then the
 * sample lists. Card art is the reference's export; names and counts are live text. A new registry rides in like the
 * reference's pushNewListCard: the cards behind it slide one slot right on a soft spring (55 ms apart), then the new
 * card settles in from 0.92 with a fade.
 */
export function RegistryStrip() {
  const created = grStore.useStore((s) => s.created);
  const pending = grStore.useStore((s) => s.pendingArrival);
  const nav = useNav();
  const reduce = useReduceMotion();
  const firstRef = useRef<HTMLDivElement>(null);

  const giftRef = useRef<HTMLButtonElement>(null);
  // landing on My Lists (reference pushNewListCard, flow 6): the cards behind the Gift registry card start one slot
  // left and make room, then it settles into the gap. A registry riding in (below) takes precedence.
  useLayoutEffect(() => {
    if (grStore.get().pendingArrival != null || reduce) return;
    const card = giftRef.current;
    const strip = card?.parentElement;
    if (!card || !strip) return;
    const kids = [...strip.children] as HTMLElement[];
    const behind = kids.slice(kids.indexOf(card) + 1);
    strip.style.scrollSnapType = 'none';
    // ~250 ms after the push has landed; the card rises as the gap is about half open
    const start = 0.5;
    behind.forEach((el, i) => animate(el, { x: [-giftregistryTokens.stripSlot, 0] }, { ...SOFT, delay: start + i * STAGGER }));
    animate(card, { opacity: [0, 1], scale: [0.94, 1], y: [6, 0] }, settle(start + 0.35));
    const t = setTimeout(() => {
      strip.scrollLeft = 0;
      strip.style.scrollSnapType = '';
    }, 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (pending == null) return;
    const card = firstRef.current;
    const strip = card?.parentElement;
    if (!card || !strip) return;
    strip.scrollLeft = 0;
    grStore.patch((g) => ({ pendingArrival: null, created: g.created.map((r) => (r.id === pending ? { ...r, shown: true } : r)) }));
    // the flow sheet drops first; then the strip makes room
    const start = 0.35;
    if (!reduce) {
      const behind = [...strip.children].filter((c) => c !== card) as HTMLElement[];
      behind.forEach((el, i) => animate(el, { x: [-giftregistryTokens.stripSlot, 0] }, { ...SOFT, delay: start + i * STAGGER }));
      animate(card, { opacity: [0, 1], scale: [0.94, 1], y: [6, 0] }, settle(start + 0.35));
    }
  }, [pending, reduce]);

  return (
    <>
      {created.map((r, i) => (
        <RegistryCard key={r.id} registry={r} ref={i === 0 ? firstRef : undefined} />
      ))}
      <Pressable ref={giftRef} className={styles.tile} scale={0.97} onClick={() => nav.sheet('giftregistry/create')} aria-label={newRegistryCard.name}>
        <img className={styles.art} src={newRegistryCard.art} alt="" />
        <span className={styles.name}>{newRegistryCard.name}</span>
        <span className={styles.count}>{newRegistryCard.count}</span>
      </Pressable>
      {listCards.map((l) => (
        <Pressable key={l.id} className={styles.tile} scale={0.97} onClick={() => nav.toast(`${l.name} — the collection screen is not in this prototype`)} aria-label={l.name}>
          <img className={styles.art} src={l.art} alt="" />
          <span className={styles.name}>{l.name}</span>
          <span className={styles.count}>{l.count}</span>
        </Pressable>
      ))}
    </>
  );
}

/** the new registry's card: Figma's empty collection tray art for its occasion (861:323099), name, "Add items" */
function RegistryCard({ registry, ref }: { registry: Registry; ref?: React.Ref<HTMLDivElement> }) {
  const nav = useNav();
  return (
    <motion.div ref={ref} className={styles.slot}>
      <Pressable
        className={styles.tile}
        scale={0.97}
        onClick={() => (haptics.lift(), nav.push('giftregistry/registry', { id: String(registry.id) }, { transition: 'gr-push' }))}
        aria-label={registry.name}
      >
        <img className={styles.tray} src={trayArt(registry.occasion)} alt="" />
        {/* the collection cards' grey tab at the top centre (baked into their art exports; drawn here for the tray art) */}
        <span className={styles.tab} aria-hidden />
        <span className={styles.name}>{registry.name}</span>
        <span className={styles.count}>Add items</span>
      </Pressable>
    </motion.div>
  );
}
