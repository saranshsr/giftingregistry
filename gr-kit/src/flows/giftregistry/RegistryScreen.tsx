import { motion } from 'motion/react';
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { Lottie, MaskIcon, OriginIcon, Pressable, Screen } from '../../components';
import { useNav } from '../../kit/Navigator';
import { useStatusBar } from '../../kit/statusBar';
import type { ScreenProps } from '../../kit/types';
import { useReduceMotion } from '../../motion/reducedMotion';
import { NanoButton } from './components/NanoButton';
import { ThemedBackground } from './components/ThemedBackground';
import { haptics } from './haptics';
import { arrive } from './motion';
// a copy of the empty-list lottie without its baked white: the full-size solid ("Shape Layer 4") and the white fade it hid
// ("Shape Layer 3", fully under the solid, so never seen), so the page’s tinted grid
// shows behind it; the original file is kept as delivered
import emptyLottie from '@assets/giftregistry/lottie/registry-empty-nobg.lottie';
import { grStore, type Registry } from './store';
import { themeOf } from './theme';
import { stickyTheme, type ThemeFamily } from './tokens';
import styles from './registry.module.css';

/**
 * 05 The new registry (Figma Zs6qEAZ1Uaej4LcKst0sbp · 843:723290 "Birthday · Gift list creation flow · Option 3"):
 * occasion header (art, back, settings, the registry's name and "<date> • <n> days to go!"), the empty state (three
 * cards, "Tap the heart icon for gifts you want!", Search gifts), "Find gifts to add" further down, and the sticky
 * "Explore curated gifts" strip at the bottom. Drawn for Birthday; other occasions take their colours from theme.ts.
 * Back returns to My Lists, where the new registry card then rides into the strip.
 */
const files = import.meta.glob('../../assets/giftregistry/registry/*.{png,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const img = (n: string) => files[`../../assets/giftregistry/registry/${n}`];
const backdrops = import.meta.glob('../../assets/giftregistry/themes/backdrop-*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const backdrop = Object.fromEntries(Object.entries(backdrops).map(([k, v]) => [k.match(/backdrop-(\w+)\.jpg$/)![1], v])) as Record<ThemeFamily, string>;

const CATEGORIES: { label: string; art: ReactNode }[] = [
  { label: 'Perfumes', art: <img src={img('cat-perfumes.png')} alt="" style={{ left: -6, top: 36, width: 100, height: 103 }} /> },
  { label: 'Books', art: <img src={img('cat-books.png')} alt="" style={{ left: -17, top: 42, width: 122, height: 122 }} /> },
  {
    label: 'Games & Toys',
    art: (
      <>
        <img src={img('cat-games-b.png')} alt="" style={{ left: 11.6, top: 55, width: 47.5, height: 73.8 }} />
        <img src={img('cat-games-a.png')} alt="" style={{ left: 51.8, top: 75.7, width: 29.7, height: 44.9 }} />
      </>
    ),
  },
  { label: 'Electronics', art: <img src={img('cat-electronics.png')} alt="" style={{ left: 15, top: 50, width: 60, height: 72, objectPosition: 'bottom' }} /> },
  {
    label: 'Beauty',
    art: (
      <>
        <img src={img('cat-beauty-a.png')} alt="" style={{ left: 8, top: 49, width: 46, height: 63 }} />
        <img src={img('cat-beauty-b.png')} alt="" style={{ left: 49, top: 49, width: 27, height: 77 }} />
      </>
    ),
  },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ordinal = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
function when(digits: string) {
  if (digits.length !== 8) return null;
  const d = new Date(+digits.slice(4), +digits.slice(2, 4) - 1, +digits.slice(0, 2));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 864e5);
  return {
    date: `${ordinal(d.getDate())} ${MONTHS[d.getMonth()]}`,
    countdown: days > 1 ? `${days} days to go!` : days === 1 ? '1 day to go!' : days === 0 ? 'It’s today!' : 'Event passed',
  };
}

export function RegistryScreen({ params }: ScreenProps<{ id?: string; from?: 'create' }>) {
  const nav = useNav();
  const reduce = useReduceMotion();
  const created = grStore.useStore((s) => s.created);
  const registry: Registry = created.find((r) => String(r.id) === params.id) ?? created[0] ?? { id: 0, name: 'Prasanna’s Birthday', occasion: 'birthday', date: '' };
  const theme = themeOf(registry.occasion);
  const w = when(registry.date);
  // Birthday's backdrop is deep, so its header copy and status bar are white; the other backdrops are light
  const dark = (theme.family ?? 'birthday') === 'birthday';
  useStatusBar(dark ? 'light' : 'dark');
  const later = () => nav.toast('Not in this prototype');
  const back = () => {
    haptics.lightTap();
    // My Lists makes room for the new card as it comes back into view
    if (registry.id && !registry.shown) grStore.patch({ pendingArrival: registry.id });
    nav.back();
  };
  // from Create: the page (backdrop, header, grid) cross-fades in over the steps' themed background (450 ms ease-out
  // cubic), then the title, countdown and body rise 8 pt on the MOVE spring 60 ms apart, the sticky strip last
  const handoff = params.from === 'create' && !reduce;
  // the registry lands as the cross-fade completes: settle, then success 160 ms later (nano rule 5), still inside
  // iOS Safari's ~1 s after the Create tap
  useEffect(() => {
    if (params.from !== 'create') return;
    const t = setTimeout(haptics.settleThenSuccess, reduce ? 0 : 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rise = (i: number, y = 8) =>
    reduce ? {} : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: arrive((handoff ? 0.3 : 0.12) + i * 0.06, 0.3) };
  // the sticky strip and category cards take their occasion's Figma colours (Mother's day has its own lilac)
  const st = stickyTheme[registry.occasion === 'mothersday' ? 'mothersday' : (theme.family ?? 'birthday')];
  const vars = {
    '--accent': theme.accent,
    '--deep': theme.ctaA,
    '--edge': theme.ctaB,
    '--tint-a': theme.tintA,
    '--tint-b': theme.tintB,
    '--fade': st.fade,
    '--cat-a': st.catA,
    '--cat-b': st.catB,
    '--cat-ink': st.ink === 'light' ? 'var(--nk-color-text-inverse)' : 'var(--nk-color-text-primary)',
  } as CSSProperties;

  return (
    <Screen
      background="bgSurface"
      safeTop={false}
      floatingFooter
      contentStyle={{ paddingBottom: 0 }}
      footer={
        <motion.div className={styles.sticky} style={vars} {...rise(6, 12)}>
          <SectionTitle>Explore curated gifts</SectionTitle>
          <div className={`nk-hscroll ${styles.cats}`}>
            {CATEGORIES.map((c) => (
              <Category key={c.label} {...c} onPress={later} />
            ))}
          </div>
        </motion.div>
      }
    >
      {/* the Delivery step's background, held under the page while it fades in (no flash of white) */}
      {handoff && (
        <div className={styles.handoffBg} aria-hidden>
          <ThemedBackground theme={theme} />
        </div>
      )}
      <motion.div
        className={styles.page}
        style={vars}
        {...(handoff ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.45, ease: [0.215, 0.61, 0.355, 1] } } : {})}
      >
        {/* header: the occasion art (Birthday's own picture; the other occasions in their deep colour) */}
        {/* the occasion's full-screen backdrop (Figma 575:158585 bottom row), its top 196 pt as the header */}
        <header className={styles.header} data-tone={dark ? 'dark' : 'light'}>
          <img className={styles.headerArt} src={backdrop[theme.family ?? 'birthday']} alt="" />
          <div className={styles.headerBar}>
            <Pressable className={styles.headBtn} onClick={back} aria-label="Back">
              <MaskIcon src={img('icon-chevron-left.svg')} size={20} color="var(--nk-color-text-primary)" />
            </Pressable>
            <Pressable className={styles.headBtn} onClick={later} aria-label="Registry settings">
              <MaskIcon src={img('icon-cog.svg')} size={24} color="var(--nk-color-text-primary)" />
            </Pressable>
          </div>
          <div className={styles.title}>
            <motion.h1 className={styles.name} {...rise(0, 8)}>
              {registry.name}
            </motion.h1>
            {w && (
              <motion.div className={styles.when} {...rise(1, 8)}>
                <MaskIcon src={img('icon-calendar.svg')} size={16} color={dark ? 'var(--nk-color-text-inverse)' : 'var(--nk-color-text-primary)'} />
                <span className={styles.date}>{w.date}</span>
                <i className={styles.dot} />
                <b>{w.countdown}</b>
              </motion.div>
            )}
          </div>
        </header>

        {/* empty state */}
        <section className={styles.empty}>
          {/* the 180 pt Figma illustration box; the empty-list lottie (810 × 1080, looping) is placed so its card arc fills it */}
          <div className={styles.visual}>
            <motion.div className={styles.emptyLottie} {...rise(2)}>
              <Lottie
                src={emptyLottie}
                loop
                autoplay={false}
                worker
                maxDpr={2}
                style={{ width: '100%', height: '100%' }}
                onPlayer={(d) => {
                  // starts as the page lands, once the hand-off has settled
                  const go = () => setTimeout(() => d.play(), reduce ? 0 : 350);
                  if (d.isLoaded) go();
                  else d.addEventListener('load', go);
                }}
              />
            </motion.div>
          </div>
          <motion.p className={styles.emptyTitle} {...rise(3)}>
            Tap the heart icon for gifts you want!
          </motion.p>
          <motion.p className={styles.emptySub} {...rise(4)}>
            Add what you’d love to receive and share it with your family &amp; friends
          </motion.p>
          <motion.div className={styles.cta} {...rise(5)}>
            {/* nano Button v3, white secondary (Figma M-NeutralButton with the search icon); plays press / release itself */}
            <NanoButton variant="secondary" className={styles.search} onClick={later}>
              <span className={styles.searchLabel}>
                <OriginIcon name="search" size={20} color="var(--nk-color-text-primary)" />
                Search gifts
              </span>
            </NanoButton>
          </motion.div>
        </section>

        {/* further down: Find gifts to add (Figma Frame 2147242088) */}
        <section className={styles.find}>
          <SectionTitle>Find gifts to add</SectionTitle>
          <div className={styles.findRow}>
            {CATEGORIES.slice(0, 4).map((c) => (
              <Category key={c.label} {...c} onPress={later} />
            ))}
          </div>
        </section>
      </motion.div>
    </Screen>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className={styles.sectionTitle}>
      <img src={img('divider-left.svg')} alt="" />
      <span>{children}</span>
      <img src={img('divider-right.svg')} alt="" className={styles.flip} />
    </div>
  );
}

function Category({ label, art, onPress }: { label: string; art: ReactNode; onPress: () => void }) {
  return (
    <Pressable className={styles.cat} scale={0.97} onClick={onPress} aria-label={label}>
      <span className={styles.catLabel}>{label}</span>
      <span className={styles.catArt}>{art}</span>
    </Pressable>
  );
}
