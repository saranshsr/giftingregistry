/**
 * Warm the whole flow while the Account intro plays, so nothing is fetched mid-transition over the network:
 * screen chunks (nav.preload, done by the caller), every lottie the flow can play (fetched into the HTTP cache),
 * every image (fetched and decoded) and the Noontree weights. Default and Birthday first, then the rest, in idle time.
 */
// the delivered empty-list lottie (registry-empty.*) is replaced on the page by its no-white copy, so it isn't warmed
const lotties = import.meta.glob(['../../assets/giftregistry/lottie/*.{lottie,json}', '!**/registry-empty.{lottie,json}'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
// create/hero-bg.jpg (the export with baked dark corners) is replaced on the page by hero-bg-full.jpg, so it isn't warmed
const images = import.meta.glob(['../../assets/giftregistry/*/*.{png,jpg,svg,webp}', '!**/create/hero-bg.jpg'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const decoded = new Map<string, Promise<void>>();
/** fetch + decode one image (shared, so a later caller just awaits the same promise) */
export function decodeImage(src: string): Promise<void> {
  let p = decoded.get(src);
  if (!p) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    p = img.decode().catch(() => undefined);
    decoded.set(src, p);
  }
  return p;
}
/** decode before a transition, but never wait longer than `cap` ms */
export const decodeSoon = (srcs: string[], cap = 300) => Promise.race([Promise.all(srcs.map(decodeImage)), new Promise((r) => setTimeout(r, cap))]);

const fetched = new Set<string>();
const prefetch = (url: string) => {
  if (fetched.has(url)) return Promise.resolve();
  fetched.add(url);
  return fetch(url, { cache: 'force-cache' })
    .then((r) => r.arrayBuffer())
    .then(
      () => undefined,
      () => undefined,
    );
};

const first = (k: string) => /default|birthday|gift-hero|registry-empty|bg-birthday|backdrop-birthday|tray-birthday/.test(k);
const idle = (fn: () => void) => ((window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1)))(fn);

let started = false;
export function warmFlow() {
  if (started) return;
  started = true;
  // the brand face in every weight the flow sets, so no text swaps later
  ['400', '500', '600', '700'].forEach((w) => document.fonts?.load(`${w} 16px Noontree`).catch(() => undefined));
  const jobs = [...Object.entries(lotties).map(([k, u]) => ({ k, run: () => prefetch(u) })), ...Object.entries(images).map(([k, u]) => ({ k, run: () => decodeImage(u) }))].sort(
    (a, b) => Number(first(b.k)) - Number(first(a.k)),
  );
  // a few at a time, in idle slices, so the intro keeps its frames
  let i = 0;
  const next = () =>
    idle(() => {
      const batch = jobs.slice(i, i + 4);
      i += 4;
      if (!batch.length) return;
      Promise.all(batch.map((j) => j.run())).then(next);
    });
  next();
}
