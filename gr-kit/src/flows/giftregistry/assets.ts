import type { OccasionKey } from './tokens';
import { occasionOf, steps, type StepId } from './data';
import explainerHero from '@assets/giftregistry/lottie/gift-hero-v2-nobg.json?url';

/**
 * Gift Registry art. Hero lotties: occasions/export (AE comps → dotLottie, 1125 × 528, 60 fps, play once, hold the
 * last frame). Card art: the reference prototype's layers (gifting-registry-noon.vercel.app/v4/assets).
 */
const lotties = import.meta.glob('../../assets/giftregistry/lottie/*.lottie', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const lottieUrl = (name: string) => {
  const url = lotties[`../../assets/giftregistry/lottie/${name}.lottie`];
  if (!url) console.error(`[giftregistry] missing lottie ${name}`);
  return url;
};

/**
 * 1.1 plays its Default set until an occasion is picked, then that occasion's (same art and timing, other swoosh).
 * A later step opened straight from its URL (no occasion yet) shows the Birthday set.
 */
export const heroLottie = (step: StepId, occ: OccasionKey | null) =>
  lottieUrl(`gr-hero-${steps[step].lottie}-${occ ? occasionOf(occ).file : step === 'occ' ? 'default' : step === 'due' ? 'baby-shower' : 'birthday'}`);
export { explainerHero };

const img = import.meta.glob('../../assets/giftregistry/*/*.{png,jpg,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const art = (path: string) => img[`../../assets/giftregistry/${path}`];
export const occArt = (k: OccasionKey) => art(`occ/${k}.png`);

/** warm the browser cache so a step's hero starts on time (the reference preloaded the picked occasion's set) */
export const warmLottie = (...urls: (string | undefined)[]) => urls.forEach((u) => u && fetch(u, { cache: 'force-cache' }).catch(() => undefined));

const backdrops = import.meta.glob('../../assets/giftregistry/themes/backdrop-*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
/** the registry page header art for a theme (Figma 575:158585 bottom row) */
export const registryBackdrop = (family: string | null) => backdrops[`../../assets/giftregistry/themes/backdrop-${family ?? 'birthday'}.jpg`];
