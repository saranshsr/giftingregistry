import { AnimatePresence, motion, usePresence } from 'motion/react';
import { useEffect, useId, useRef, type RefObject } from 'react';
import { fade } from '../motion';
import { holdRecolour } from './HeroLottie';
import type { Theme } from '../theme';
import type { ThemeFamily } from '../tokens';

/** Figma's Onboarding background per theme (575:158585) plus the Default page (843:769327): Figma's own raster render (1125 × 705 = 3x),
 *  so the soft light rays stay as smooth as in Figma (Chrome renders the SVG blur filters harsh and stripy) */
const files = import.meta.glob('../../../assets/giftregistry/themes/bg-*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const themeBg = Object.fromEntries(Object.entries(files).map(([k, v]) => [k.match(/bg-(\w+)\.jpg$/)![1], v])) as Partial<Record<ThemeFamily | 'default', string>>;

/**
 * Figma "Onboarding background" (component 2:22802, 375 × 235): each occasion theme's own export (575:158585); the
 * Default page (before an occasion is picked) is drawn from its colours: the page wash with its four
 * soft light beams. A new theme cross-fades in over the old one (450 ms, ease-out cubic; the reference's regBg.set
 * used 700 ms material-standard in flow 6, 450 ms ease-out elsewhere). The outgoing washes stay fully opaque underneath
 * until the newest one is fully in, so re-picking mid-fade never lets the page dip toward white. Each cross-fade holds the
 * 1.1 recolour queue (`useRecolourQueue`, HeroLottie.tsx) until it is done, so a quick re-pick waits for it.
 * Geometry is the Figma vector, so its numbers stay literal.
 */
export function ThemedBackground({ theme }: { theme: Theme }) {
  const waiting = useRef(new Set<() => void>());
  // the first wash appears without a fade (AnimatePresence initial={false}); every later one cross-fades in
  const seen = useRef(false);
  useEffect(() => void (seen.current = true), []);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 235, pointerEvents: 'none' }}>
      <AnimatePresence initial={false}>
        <Wash key={themeKey(theme)} theme={theme} waiting={waiting} swap={seen.current} />
      </AnimatePresence>
    </div>
  );
}

/** longest an outgoing wash waits for its successor */
const HOLD_MAX = 1500;

function Wash({ theme, waiting, swap }: { theme: Theme; waiting: RefObject<Set<() => void>>; swap: boolean }) {
  const [isPresent, safeToRemove] = usePresence();
  const present = useRef(isPresent);
  // a cross-fade holds the recolour queue until it is done (or this wash unmounts)
  const hold = useRef<(() => void) | null>(null);
  const swapAtMount = useRef(swap);
  useEffect(() => {
    if (!swapAtMount.current) return;
    const release = holdRecolour();
    hold.current = release;
    return release;
  }, []);
  useEffect(() => {
    present.current = isPresent;
    if (isPresent) return;
    const release = () => {
      waiting.current.delete(release);
      safeToRemove();
    };
    waiting.current.add(release);
    const t = setTimeout(release, HOLD_MAX);
    return () => clearTimeout(t);
  }, [isPresent, safeToRemove, waiting]);
  const bgSrc = themeBg[theme.family ?? 'default'];
  return (
    <motion.div
      style={{ position: 'absolute', inset: 0 }}
      data-theme-bg={theme.key}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fade(0.45)}
      // the newest wash, once fully in, lets the ones under it go
      onAnimationComplete={() => {
        hold.current?.();
        if (present.current) [...waiting.current].forEach((r) => r());
      }}
    >
      {bgSrc ? <img src={bgSrc} alt="" style={{ display: 'block', width: '100%', height: 235, objectFit: 'fill' }} /> : <BgSvg t={theme} />}
    </motion.div>
  );
}

const themeKey = (t: Theme) => `${t.key}-${t.top}`;

function BgSvg({ t }: { t: Theme }) {
  const n = useId().replace(/:/g, '');
  const lg = (id: string, y1: number, y2: number, a: string, b: string, aOpacity?: number) => (
    <linearGradient id={n + id} x1="187.6" y1={y1} x2="187.6" y2={y2} gradientUnits="userSpaceOnUse">
      <stop style={{ stopColor: a, stopOpacity: aOpacity }} />
      <stop offset="1" style={{ stopColor: b }} />
    </linearGradient>
  );
  const blur = (id: string, x: number, y: number, w: number, h: number, s: number) => (
    <filter id={n + id} x={x} y={y} width={w} height={h} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feGaussianBlur stdDeviation={s} />
    </filter>
  );
  const white = 'var(--nk-palette-white)';
  return (
    <svg width="100%" height="235" viewBox="0 0 375 235" preserveAspectRatio="none" fill="none" style={{ display: 'block' }} aria-hidden>
      <defs>
        {blur('f0', -21.07, 23.58, 417.39, 196.81, 3.5)}
        {blur('f1', 83.66, -37.3, 207.94, 257.68, 2.5)}
        {blur('f2', 13.94, -41.85, 347.37, 272.61, 2.5)}
        {lg('p0', 20.88, 270.23, t.top, t.bot)}
        {lg('p1', 40.58, 203.38, t.beams[0], white)}
        {lg('p2', -20.3, 203.38, t.beams[1], white)}
        {lg('p3', 0, 188.9, t.beams[2], white)}
        {lg('p4', 24.16, 171.49, t.beams[3], white)}
        {lg('p5', 82.88, 187.88, white, white, 0)}
        <clipPath id={n + 'c'}>
          <rect width="375" height="235" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${n}c)`}>
        <rect width="375" height="235" fill={`url(#${n}p0)`} />
        <g opacity="0.4" filter={`url(#${n}f0)`}>
          <path
            d="M282.16 178.408L377.507 40.5803L-2.25 40.5771L93.0978 178.408C103.918 194.05 121.726 203.384 140.746 203.384H234.512C253.531 203.384 271.339 194.05 282.16 178.408Z"
            stroke={`url(#${n}p1)`}
            strokeWidth="4"
          />
        </g>
        <g opacity="0.8" filter={`url(#${n}f1)`}>
          <path
            d="M230.664 169.099L274.085 -20.2916L101.172 -20.2959L144.593 169.098C149.192 189.161 167.045 203.384 187.629 203.384C208.212 203.384 226.065 189.161 230.664 169.099Z"
            stroke={`url(#${n}p2)`}
            strokeWidth="4"
          />
        </g>
        <g opacity="0.5" filter={`url(#${n}f2)`}>
          <path
            d="M253.113 151.836L311.738 0.00460756L63.5195 0.000976562L122.145 151.836C130.77 174.174 152.248 188.904 176.194 188.904H199.065C223.01 188.904 244.488 174.174 253.113 151.836Z"
            stroke={`url(#${n}p3)`}
            strokeWidth="33.71"
          />
        </g>
        <g opacity="0.4">
          <path
            d="M192.009 167.197L194.935 24.162L180.32 24.1592L183.246 167.197C183.295 169.582 185.242 171.49 187.628 171.49C190.013 171.49 191.96 169.582 192.009 167.197Z"
            stroke={`url(#${n}p4)`}
            strokeWidth="33.71"
          />
        </g>
        <rect x="0.128" y="82.879" width="375" height="152.121" fill={`url(#${n}p5)`} />
      </g>
    </svg>
  );
}
