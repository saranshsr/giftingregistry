import { useEffect, useState } from 'react';
import { prepareHaptics } from './haptics';
import { AccountScreen as KitAccountScreen } from '../account/AccountScreen';
import { useNav } from '../../kit/Navigator';
import { GiftRegistriesCard } from './components/GiftRegistriesCard';
import { ordersThumbs } from './products';
import { grStore } from './store';
import { warmFlow } from './warm';

/**
 * 01 Account: the kit's own live Account screen (src/flows/account) with the "My Wishlist" action card swapped for the
 * Gift Registries card, whose teaser plays as the page lands, and the reference's photos in the My Orders tiles.
 * "Need help?" folds 1 s after the card's teaser starts (the reference's 2.6 s from page entry, measured against its
 * delayed `play()`); if no start is reported it folds 2.6 s after the page lands.
 */
const FOLD_AFTER_INTRO = 1000;
const FOLD_FALLBACK = 2600;

export function AccountScreen() {
  const nav = useNav();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // every screen chunk, then (in idle time) every lottie, image and font weight the flow uses
    nav.preload('giftregistry/lists', 'giftregistry/create', 'giftregistry/steps', 'giftregistry/address', 'giftregistry/registry');
    warmFlow();
    prepareHaptics();
  }, []);
  const started = grStore.useStore((s) => s.introStartedAt);
  const [fold, setFold] = useState(false);
  useEffect(() => {
    const wait = started != null ? Math.max(0, started + FOLD_AFTER_INTRO - performance.now()) : FOLD_FALLBACK;
    const t = setTimeout(() => setFold(true), wait);
    return () => clearTimeout(t);
  }, [started]);
  return <KitAccountScreen secondCard={<GiftRegistriesCard />} helpCollapsed={fold} ordersThumbs={ordersThumbs} />;
}
