import { Fragment, StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { setWasmUrl } from '@lottiefiles/dotlottie-react';
import { giftregistryFlow } from '../flows/giftregistry';
import { accountFlow } from '../flows/account';
import { wishlistFlow } from '../flows/wishlist';
import type { FlowDef } from '../kit/types';
import { NoonPrototype } from '../kit/NoonPrototype';
import { layout } from '../foundations/tokens';
import { createRegistry } from '../kit/registry';
import { parsePageUrl } from '../kit/routes';
import type { Route, StackEntry } from '../kit/types';
import '../motion/custom';
import { FlowSelector } from './FlowSelector';
import { reviewGroups, reviewTitle } from './reviewFlows';
import './preview.css';

/**
 * Dev preview: the phone on its own. Every page is a URL — `/homepage`, `/plp?query=x`, `/orders` (see kit/routes.ts)
 * or the legacy `#/flow/screen`; `/` opens home. Not part of the package.
 */
// First load carries only what the review opens on (Gift Registry plus the Account and Wishlist screens it wraps);
// the other kit flows load in idle time after the first paint, or up front when the URL asks for one of them.
const coreFlows: FlowDef[] = [giftregistryFlow, accountFlow, wishlistFlow];
let registry = createRegistry(coreFlows);
const loadAllFlows = () => import('../flows').then((m) => m.allFlows);

// Lottie player from our own server (cached with the app) instead of the jsdelivr CDN on the first animation. A path,
// not a package import: the wasm is not in dotlottie-web's exports map. Same installed version as the player JS.
setWasmUrl(new URL('../../node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm', import.meta.url).href);

// used by scripts/check-routes.mjs
(window as unknown as { __NK_ROUTES__: string[] }).__NK_ROUTES__ = registry.all().map((r) => r.route);

const readUrl = (): { route?: Route; params: Record<string, string> } => {
  const { route, params } = parsePageUrl(window.location);
  return { route: route ? registry.resolve(route)?.route : undefined, params };
};

// On a phone (a narrow viewport: a browser, a home-screen app or a prototype-player webview) the screen fills the
// device instead of sitting in a 390 × 844 frame with padding, which overflowed and scrolled. It keeps the 390 pt layout
// width, scales to the viewport width and takes the viewport's height, so nothing scrolls and nothing is letterboxed.
// innerHeight, not visualViewport: the keyboard must not resize the screen.
const FIT_MAX_WIDTH = 600;
function useDeviceFit() {
  const read = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w > FIT_MAX_WIDTH) return undefined;
    const scale = w / layout.deviceWidth;
    return { scale, height: Math.round((h / scale) * 100) / 100 };
  };
  const [fit, setFit] = useState(read);
  useEffect(() => {
    // a webview that shrinks the window for the keyboard (Android adjustResize) must not squash the screen: while a
    // field has focus and the width is unchanged, height changes are the keyboard and are ignored
    let lastW = window.innerWidth;
    const on = () => {
      const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      if (typing && window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      setFit(read());
    };
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  // The keyboard lays over the screen instead of pushing it up. iOS pans the visual viewport to bring a focused field
  // above the keyboard, which carries the whole fixed screen up with it; the screen follows the pan back down
  // (--nk-vv-top = the pan), and any document scroll iOS adds is undone. Android Chrome: interactive-widget in index.html.
  useEffect(() => {
    if (!fit) return;
    const vv = window.visualViewport;
    const root = document.documentElement;
    let raf = 0;
    const pin = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (window.scrollY || window.scrollX) window.scrollTo(0, 0);
        root.style.setProperty('--nk-vv-top', `${vv ? Math.max(0, vv.offsetTop) : 0}px`);
      });
    };
    vv?.addEventListener('scroll', pin);
    vv?.addEventListener('resize', pin);
    window.addEventListener('scroll', pin);
    document.addEventListener('focusin', pin);
    document.addEventListener('focusout', pin);
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener('scroll', pin);
      vv?.removeEventListener('resize', pin);
      window.removeEventListener('scroll', pin);
      document.removeEventListener('focusin', pin);
      document.removeEventListener('focusout', pin);
      root.style.removeProperty('--nk-vv-top');
    };
  }, [!!fit]);
  useEffect(() => {
    document.documentElement.classList.toggle('nk-fit', !!fit);
  }, [fit]);
  return fit;
}

function Preview({ initialFlows }: { initialFlows: FlowDef[] }) {
  const fit = useDeviceFit();
  const [page, setPage] = useState(() => ({ ...readUrl(), nonce: 0 }));
  const [allLoaded, setAllLoaded] = useState(initialFlows);
  useEffect(() => {
    if (initialFlows !== coreFlows) return;
    const idle = (cb: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 1500));
    idle(() =>
      loadAllFlows().then((all) => {
        registry = createRegistry(all);
        (window as unknown as { __NK_ROUTES__: string[] }).__NK_ROUTES__ = registry.all().map((r) => r.route);
        setAllLoaded(all);
      }),
    );
  }, [initialFlows]);

  useEffect(() => {
    const onUrl = () => setPage((p) => ({ ...readUrl(), nonce: p.nonce + 1 }));
    window.addEventListener('popstate', onUrl);
    window.addEventListener('hashchange', onUrl);
    return () => {
      window.removeEventListener('popstate', onUrl);
      window.removeEventListener('hashchange', onUrl);
    };
  }, []);

  const [route, setRoute] = useState<Route>();
  // Keep the address bar on the page's clean URL, e.g. /homepage, /plp, /checkout/cards-select.
  const onRouteChange = useCallback((r: Route, s: StackEntry[]) => {
    setRoute(r);
    const p = s.at(-1)?.params ?? {};
    // used by scripts/journeys.mjs: the current route and stack
    (window as unknown as { __NK_NAV__: unknown }).__NK_NAV__ = { route: r, stack: s.map((e) => e.route), params: p };
    const query = new URLSearchParams(Object.entries(p).flatMap(([k, v]) => (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? [[k, String(v)]] : []))).toString();
    window.history.replaceState(null, '', `/${registry.pathFor(r)}${query ? `?${query}` : ''}`);
  }, []);

  return (
    <div className="pg-stage">
      <NoonPrototype key={page.nonce} fit={fit} flows={allLoaded} initialRoute={page.route} initialParams={page.params} onRouteChange={onRouteChange} />
      {/* review shell: the Gift Registry flows, collapsed to a handle (opens a slim panel, or a sheet on phones) */}
      <FlowSelector
        title={reviewTitle}
        groups={reviewGroups}
        current={route}
        isAvailable={(r) => !!registry.resolve(r)}
        // a full load so each flow starts from scratch (its module stores too)
        onOpen={(f) => window.location.assign(`/${registry.pathFor(registry.resolve(f.route)!.route)}`)}
        onRestart={() => {
          const f = reviewGroups.flatMap((g) => g.flows).find((x) => x.route.split('/')[0] === route?.split('/')[0]);
          const start = registry.resolve(f?.route ?? route ?? '');
          window.location.assign(start ? `/${registry.pathFor(start.route)}` : '/');
        }}
      />
    </div>
  );
}

// StrictMode renders every screen twice in dev, which doubles the cost of each push. Opt in while debugging effects:
// `VITE_STRICT=1 npm run dev`.
const Root = import.meta.env.VITE_STRICT ? StrictMode : Fragment;
// a URL outside the core flows (e.g. /homepage) waits for the full set before the first render
const start = parsePageUrl(window.location).route;
const ready: Promise<FlowDef[]> =
  start && !registry.resolve(start)
    ? loadAllFlows().then((all) => {
        registry = createRegistry(all);
        (window as unknown as { __NK_ROUTES__: string[] }).__NK_ROUTES__ = registry.all().map((r) => r.route);
        return all;
      })
    : Promise.resolve(coreFlows);
ready.then((initialFlows) =>
  createRoot(document.getElementById('root')!).render(
    <Root>
      <Preview initialFlows={initialFlows} />
    </Root>,
  ),
);

