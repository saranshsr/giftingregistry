import type { TokenOverrides } from '../../foundations/tokens';
import { accountFlowTokens } from '../account/tokens';
import { wishlistFlowTokens } from '../wishlist/tokens';

/**
 * Gift Registry values with no global token. Occasion themes are Figma's own (Zs6qEAZ1Uaej4LcKst0sbp, section
 * "02. Occasion themes" 575:158585): each theme's Onboarding background (exported as-is, src/assets/giftregistry/themes),
 * its nano-button CTA stops and its full-screen backdrop. Birthday and Baby shower keep the accents drawn on the step
 * frames (843:723065, 843:723219); the other themes take their accent and tints from their background's hue (theme.ts).
 * Mother's day follows Birthday, Anniversary follows Wedding. The selected tile follows the reference (REG_TILE_THEME).
 */
export type OccasionKey = 'eid' | 'birthday' | 'babyshower' | 'mothersday' | 'wedding' | 'housewarming' | 'anniversary' | 'other';
export type ThemeFamily = 'birthday' | 'eid' | 'wedding' | 'babyshower' | 'housewarming' | 'other';
export const themeFamily: Record<OccasionKey, ThemeFamily> = {
  birthday: 'birthday',
  mothersday: 'birthday',
  eid: 'eid',
  wedding: 'wedding',
  anniversary: 'wedding',
  babyshower: 'babyshower',
  housewarming: 'housewarming',
  other: 'other',
};

/** each theme's Onboarding background stops (Figma 575:158585): [top (also the deep beams), light beams] */
export const swoosh: Record<ThemeFamily, [string, string]> = {
  birthday: ['#ffa5c2', '#ffcbdb'], // token-lint-ignore — Figma theme background
  eid: ['#ffbe55', '#ffebd1'], // token-lint-ignore — Figma theme background
  wedding: ['#e87d73', '#ffddda'], // token-lint-ignore — Figma theme background
  babyshower: ['#60b0e9', '#d5ebff'], // token-lint-ignore — Figma theme background
  housewarming: ['#e0a47d', '#ffe5d3'], // token-lint-ignore — Figma theme background
  other: ['#c89b6a', '#ffe8d1'], // token-lint-ignore — Figma theme background
};

/** each theme's nano-button CTA (Figma 575:158585): [deep centre, edge] */
export const themeCta: Record<ThemeFamily, [string, string]> = {
  birthday: ['#4f0214', '#83001f'], // token-lint-ignore — Figma theme CTA
  eid: ['#4f3102', '#b87100'], // token-lint-ignore — Figma theme CTA
  wedding: ['#4f1402', '#832500'], // token-lint-ignore — Figma theme CTA
  babyshower: ['#07284b', '#08407d'], // token-lint-ignore — Figma theme CTA
  housewarming: ['#47220b', '#76360f'], // token-lint-ignore — Figma theme CTA
  other: ['#4a2a07', '#ab6011'], // token-lint-ignore — Figma theme CTA (via #7a450c at the middle)
};

/**
 * The registry page's "Bottom sticky variants" strip per occasion (Figma 843:723613 and its copy in each occasion's
 * page): `fade` = the colour the strip fades to at its foot (from fully clear at its top), `catA → catB` = the category
 * card's radial (bright at the top centre → deep at 140.75 pt), `ink` = its label colour. Birthday from the design
 * context; the others measured off their frames (a two-stop fit, within 3/255). Mother's day has its own lilac strip
 * although its steps share Birthday's theme.
 */
export const stickyTheme: Record<ThemeFamily | 'mothersday', { fade: string; catA: string; catB: string; ink: 'light' | 'dark' }> = {
  birthday: { fade: '#e69cb4', catA: '#ed2658', catB: '#570725', ink: 'light' }, // token-lint-ignore — Figma sticky strip
  eid: { fade: '#f9d9a5', catA: '#f6d6a0', catB: '#b06f19', ink: 'dark' }, // token-lint-ignore — Figma sticky strip
  wedding: { fade: '#f7bdb1', catA: '#ffccb7', catB: '#b83d2f', ink: 'dark' }, // token-lint-ignore — Figma sticky strip
  babyshower: { fade: '#bcdaee', catA: '#aed4ec', catB: '#2191e5', ink: 'dark' }, // token-lint-ignore — Figma sticky strip
  housewarming: { fade: '#eecaab', catA: '#efcdae', catB: '#be632c', ink: 'dark' }, // token-lint-ignore — Figma sticky strip
  mothersday: { fade: '#d2bdef', catA: '#d9cbf1', catB: '#825ac5', ink: 'dark' }, // token-lint-ignore — Figma sticky strip (its own lilac)
  other: { fade: '#e5c6a3', catA: '#e5c39e', catB: '#a46927', ink: 'dark' }, // token-lint-ignore — Figma sticky strip
};

/** accents drawn on the Figma step frames (the other themes derive theirs) */
export const drawnTheme: Partial<Record<ThemeFamily | 'default', Partial<Record<'top' | 'bot' | 'accent' | 'tintA' | 'tintB' | 'ctaA' | 'ctaB', string>> & { beams?: string[] }>> =
  {
    birthday: { accent: '#df4075', tintA: '#fff7f9', tintB: '#ffdae7' }, // token-lint-ignore — Figma Birthday step (843:723065)
    babyshower: { accent: '#4794d8', tintA: '#f8fbfe', tintB: '#e1edf9' }, // token-lint-ignore — Figma Baby shower step (843:723219)
    default: { top: '#a2c0f5', bot: '#fff0f5', tintA: '#f8fbfe', tintB: '#e1edf9', ctaA: '#14161c', ctaB: '#2b3140', beams: ['#a2c0f5', '#a2c0f5', '#dbe8ff', '#dbe8ff'] }, // token-lint-ignore — Figma Default page (843:769327)
  };
/** hue source for the Default accent */
export const defaultAccentSeed = '#9dbdfc'; // token-lint-ignore — Figma Default accent seed

/** reference REG_TILE_THEME: selected tile stroke / glow / label, keyed by theme family */
export const tileTheme = {
  eid: { stroke: '#f8e6c6', glow: '#f6d9a6', label: '#a86a12' }, // token-lint-ignore — reference tile theme
  birthday: { stroke: '#fde0e8', glow: '#ffc4d4', label: '#c8103f' }, // token-lint-ignore — reference tile theme
  wedding: { stroke: '#fde3dd', glow: '#fccbc2', label: '#c5504a' }, // token-lint-ignore — reference tile theme
  babyshower: { stroke: '#dcebfa', glow: '#c4def6', label: '#2f72b8' }, // token-lint-ignore — reference tile theme
  housewarming: { stroke: '#fae5d6', glow: '#f4d0b4', label: '#a8602c' }, // token-lint-ignore — reference tile theme
  other: { stroke: '#fae8cb', glow: '#f3d6a6', label: '#a87430' }, // token-lint-ignore — reference tile theme
} as const;
/** reference OCCASION_THEME: which tile theme family each occasion uses */
export const tileFamily: Record<OccasionKey, keyof typeof tileTheme> = {
  eid: 'eid',
  birthday: 'birthday',
  babyshower: 'babyshower',
  mothersday: 'birthday',
  wedding: 'wedding',
  housewarming: 'housewarming',
  anniversary: 'wedding',
  other: 'other',
};

export const giftregistryTokens = {
  /** screen geometry, pt on the 375 × 812 design */
  hero: { top: 104, height: 176 },
  bg: { height: 235 },
  /** My Lists strip slot (card 126 + gap 12 + 4): the pushNewListCard slide */
  stripSlot: 138,
  /** reference widget states (ms after the Account page lands) */
  intro: { s02: 800, s03: 1400, s04: 4700, s05: 5350, help: 2600 },
} as const;

/** The live kit Account and Wishlist screens run inside this flow, so their flow tokens come along (merged per group). */
const merge = (...all: TokenOverrides[]): TokenOverrides => {
  const out: Record<string, Record<string, unknown>> = {};
  for (const t of all) for (const [k, v] of Object.entries(t)) out[k] = { ...(out[k] ?? {}), ...(v as Record<string, unknown>) };
  return out as TokenOverrides;
};

export const giftregistryFlowTokens: TokenOverrides = merge(wishlistFlowTokens, accountFlowTokens, {
  colors: {
    grCtaRim: '#EFEFEF', // token-lint-ignore — Figma nano button rim (2:22945)
    grCtaHighlight: 'rgba(210, 210, 210, 0.4)', // token-lint-ignore — Figma nano button top inner highlight
    grNewTop: '#19CB83', // token-lint-ignore — Figma New Badge top stop (I843:720014;8009:314310)
  },
  type: {
    grStepTitle: { size: 32, line: 40, weight: 500 }, // the big centred answer / date (Figma Medium 32/40)
    grB11Bold: { size: 11, line: 14, weight: 700 }, // New Badge (Figma B11 Bold)
    grCardTitle: { size: 15, line: 18, weight: 700 }, // Account Gift Registries card title (Figma Component 225)
    grB11: { size: 11, line: 14, weight: 400 }, // Account card subtitle (Figma B11 Regular)
    grH24: { size: 24, line: 32, weight: 700 }, // registry page title (Figma H24 Bold)
    grH16: { size: 16, line: 20, weight: 700 }, // section titles (Figma H16 Bold)
    grB16Bold: { size: 16, line: 22, weight: 700 }, // empty-state title (Figma B16 Bold)
    grB14SemiboldLh16: { size: 14, line: 16, weight: 600 }, // category card label (Figma, 16 pt line)
  },
});
