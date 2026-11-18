import type { Product } from '../../data';
import type { OccasionKey } from './tokens';

/** reference photos and card art (src/assets/giftregistry/products), cut from gifting-registry-noon.vercel.app/v4 */
const files = import.meta.glob('../../assets/giftregistry/products/*.{png,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const art = (path: string) => files[`../../assets/giftregistry/${path}`];

/**
 * My Lists as the reference shows it (flow 6, assets/wishlist): the strip's sample lists and the four saved items.
 * Photos are cut from the reference's card exports (src/assets/giftregistry/products).
 */
export const listCards = [
  { id: 'lamps', name: 'Lamps and more', count: '9 Items', art: art('products/list-lamps.png') },
  { id: 'decor', name: 'Home decor', count: '2 Items', art: art('products/list-decor.png') },
  { id: 'sneakers', name: 'Sneakers', count: '1 Item', art: art('products/list-sneakers.png') },
];
export const newRegistryCard = { name: 'Gift registry', count: 'Share & get gifts', art: art('products/list-new-registry.png') };

const savedItem = (p: Pick<Product, 'id' | 'brand' | 'title' | 'price' | 'was' | 'rating' | 'ratingCount' | 'emoji' | 'image' | 'category'>): Product => ({
  ...p,
  tint: 'var(--nk-color-bg-subtle)',
  images: p.image ? [p.image] : [],
  express: true,
  delivery: 'Get it <b>Today</b>',
});
/** the reference's order and photos; item 1 keeps its copy, 2–4 get their own plausible noon listings (the kit computes the discount) */
export const savedItems: Product[] = [
  savedItem({
    id: 'gr-airpods',
    brand: 'Apple',
    title: 'Apple Airpods Pro 2 Wireless Earbuds',
    price: 899,
    was: 1399,
    rating: 4.3,
    ratingCount: 128,
    emoji: '🎧',
    image: art('products/airpods.png'),
    category: 'Electronics',
  }),
  savedItem({
    id: 'gr-anker-charger',
    brand: 'Anker',
    title: 'Anker Prime 100W GaN Wall Charger, 3 Port USB-C',
    price: 229,
    was: 299,
    rating: 4.6,
    ratingCount: 342,
    emoji: '🔌',
    image: art('products/anker-charger.png'),
    category: 'Electronics',
  }),
  savedItem({
    id: 'gr-jordan-sneakers',
    brand: 'Nike',
    title: 'Air Jordan 1 Mid Sneakers Yellow/Black',
    price: 549,
    was: 649,
    rating: 4.5,
    ratingCount: 89,
    emoji: '👟',
    image: art('products/jordan-sneakers.png'),
    category: 'Sports',
  }),
  savedItem({
    id: 'gr-bottle',
    brand: 'Milton',
    title: 'Stainless Steel Insulated Water Bottle 750ml Navy',
    price: 59,
    was: 89,
    rating: 4.4,
    ratingCount: 1204,
    emoji: '🥤',
    image: art('products/bottle.png'),
    category: 'Home & Kitchen',
  }),
];

/** the reference Account page's My Orders photos (assets/start/orders.png) */
export const ordersThumbs = [1, 2, 3, 4].map((i) => art(`products/orders-${i}.png`));

/** tag ink per art family: the deep end of the reference's tag gradient (solid here, no gradient text) */
export const tagInk = {
  birthday: '#9c0f38', // token-lint-ignore — reference CARD_THEME tag colour
  wedding: '#c2564a', // token-lint-ignore — reference CARD_THEME tag colour
  babyshower: '#2f72b8', // token-lint-ignore — reference CARD_THEME tag colour
  housewarming: '#a8622f', // token-lint-ignore — reference CARD_THEME tag colour
  other: '#a87430', // token-lint-ignore — reference CARD_THEME tag colour
} as const;

/** the new registry's card on My Lists (reference CARD_THEME, Figma 8480:637793): art family + tag */
export const registryCardTheme: Record<OccasionKey, { art: 'eid' | 'birthday' | 'wedding' | 'babyshower' | 'housewarming' | 'other'; tag: string }> = {
  eid: { art: 'eid', tag: 'Eid' }, // the export as is: its moon and tag are in the art
  birthday: { art: 'birthday', tag: 'Birthday' },
  wedding: { art: 'wedding', tag: 'Wedding' },
  anniversary: { art: 'wedding', tag: 'Anniversary' },
  mothersday: { art: 'birthday', tag: 'Mother’s day' },
  babyshower: { art: 'babyshower', tag: 'Baby shower' },
  housewarming: { art: 'housewarming', tag: 'House warming' },
  other: { art: 'other', tag: 'Gift' },
};
