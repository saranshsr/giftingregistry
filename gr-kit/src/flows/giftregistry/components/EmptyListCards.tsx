import { Pressable } from '../../../components';
import { useNav } from '../../../kit/Navigator';
import { SheetIllo } from '../CreateSheet';
import { haptics } from '../haptics';
import colLottie from '@assets/giftregistry/lottie/gr-card-portrait-collection.lottie?url';
import regLottie from '@assets/giftregistry/lottie/gr-card-portrait-registry.lottie?url';
import styles from './EmptyListCards.module.css';

/**
 * My Lists with no lists yet (Figma "Option 3 : Revamp the empty states" 843:772827, cards 845:195232 / 845:195250):
 * two 164 × 200 portrait cards. Each card's lottie covers the whole card (dev spec: gradient, glow, clouds,
 * illustration, sparkles; sheet-illos/export gr-card-portrait-*); copy, + button and the dashed border are code on top, "intro" once as the page lands, then "idle" loops. Collection → toast; Gift registry → the Create sheet
 * opened on its explainer.
 */
const CARDS = {
  collection: { title: 'Collection', sub: 'Organise & save', src: colLottie, idleShare: 67 / 276, at: 120 },
  registry: { title: 'Gift registry', sub: 'Share & track your gifts', src: regLottie, idleShare: 69 / 278, at: 180 },
} as const;

export function EmptyListCards() {
  const nav = useNav();
  return (
    <div className={styles.row}>
      {(Object.keys(CARDS) as (keyof typeof CARDS)[]).map((k) => {
        const c = CARDS[k];
        return (
          <Pressable
            key={k}
            className={styles.card}
            data-kind={k}
            scale={0.97}
            aria-label={c.title}
            onClick={() =>
              k === 'registry'
                ? (haptics.lift(), nav.sheet('giftregistry/create', { start: 'explainer' }))
                : nav.toast('Collections aren’t in this prototype')
            }
          >
            <span className={styles.visuals} aria-hidden>
              <SheetIllo src={c.src} at={c.at} idleShare={c.idleShare} />
            </span>
            <span className={styles.title}>{c.title}</span>
            <span className={styles.sub}>{c.sub}</span>
            <span className={styles.plus} aria-hidden>
              {/* Figma "icon/plus": 15 pt, 3 pt stroke, grey → black linear gradient */}
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <defs>
                  <linearGradient id={`plus-${k}`} x1="0" y1="0" x2="0" y2="15" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#898989" />
                    <stop offset="1" stopColor="#000" />
                  </linearGradient>
                </defs>
                <path d="M7.5 1.5v12M1.5 7.5h12" stroke={`url(#plus-${k})`} strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>
            {/* Figma card stroke: 1 pt inside, dash 4 / 4, r16 (CSS dashed can't set the dash length) */}
            <svg className={styles.border} aria-hidden>
              <rect x="0.5" y="0.5" rx="15.5" />
            </svg>
          </Pressable>
        );
      })}
    </div>
  );
}
