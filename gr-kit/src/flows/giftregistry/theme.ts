import { defaultAccentSeed, drawnTheme, swoosh, themeCta, themeFamily, tileFamily, tileTheme, type OccasionKey, type ThemeFamily } from './tokens';

/**
 * Per-occasion page theme (flow-proto app.js themeOf / DEFAULT_THEME). Birthday, Baby shower and Default are Figma's
 * own values; the others follow the rule Figma's two drawn themes share: bg top = mid of the swoosh stops, beams =
 * light stop, bg bottom = light stop 71% to white, accent / tints / CTA = the swoosh hue at Figma's lightness.
 */
export interface Theme {
  key: OccasionKey | 'default';
  /** Figma theme the occasion uses (null before an occasion is picked) */
  family: ThemeFamily | null;
  top: string;
  bot: string;
  beams: string[];
  accent: string;
  tintA: string;
  tintB: string;
  /** CTA: deep centre / edge */
  ctaA: string;
  ctaB: string;
  /** selected occasion tile (reference REG_TILE_THEME) */
  tile: { stroke: string; glow: string; label: string };
}

type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const toHex = (c: number[]) =>
  '#' +
  c
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const mix = (a: RGB, b: RGB, t: number) => a.map((v, i) => v + (b[i] - v) * t);
function hueOf([r, g, b]: RGB) {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const hsl = (h: number, s: number, l: number) => `hsl(${h.toFixed(1)} ${s}% ${l}%)`;
const WHITE: RGB = [255, 255, 255];

const cache = new Map<string, Theme>();

export function themeOf(key: OccasionKey | null): Theme {
  const id = key ?? 'default';
  const hit = cache.get(id);
  if (hit) return hit;
  let t: Theme;
  if (!key) {
    const d = drawnTheme.default!;
    const h = hueOf(hex(defaultAccentSeed));
    t = {
      key: 'default',
      family: null,
      top: d.top!,
      bot: d.bot!,
      beams: d.beams!,
      accent: hsl(h, 68, 56),
      tintA: d.tintA!,
      tintB: d.tintB!,
      ctaA: d.ctaA!,
      ctaB: d.ctaB!,
      tile: tileTheme.babyshower,
    };
  } else {
    const fam = themeFamily[key];
    const [a, b] = swoosh[fam];
    const s0 = hex(a),
      s1 = hex(b),
      h = hueOf(s0);
    const [ctaA, ctaB] = themeCta[fam];
    t = {
      key,
      family: fam,
      top: a,
      beams: [a, a, b, b],
      bot: toHex(mix(s1, WHITE, 0.71)),
      accent: hsl(h, 68, 46),
      tintA: hsl(h, 90, 98.4),
      tintB: hsl(h, 80, 93),
      ctaA,
      ctaB,
      tile: tileTheme[tileFamily[key]],
      ...drawnTheme[fam],
    };
  }
  cache.set(id, t);
  return t;
}

/** the tile colours for one occasion (each tile wears its own occasion's selection colours) */
export const tileColours = (key: OccasionKey) => tileTheme[tileFamily[key]];
