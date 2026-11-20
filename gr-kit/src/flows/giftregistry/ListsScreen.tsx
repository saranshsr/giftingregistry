import { useEffect } from 'react';
import { WishlistScreen } from '../wishlist/WishlistScreen';
import { useNav } from '../../kit/Navigator';
import type { ScreenProps } from '../../kit/types';
import { RegistryStrip } from './components/RegistryStrip';
import { copy } from './data';
import { haptics, prepareHaptics } from './haptics';
import { savedItems } from './products';
import { warmLottie } from './assets';
import colLottie from '@assets/giftregistry/lottie/gr-sheet-collection.lottie?url';
import regLottie from '@assets/giftregistry/lottie/gr-sheet-registry.lottie?url';
import ftuxLottie from '@assets/giftregistry/lottie/gr-ftux-explainer.lottie?url';

/**
 * 02 My Lists: the kit's live Wishlist screen (src/flows/wishlist) titled "My Lists", its Create pill opening the
 * Create sheet, the reference's strip (registries, Gift registry, its sample lists) and its saved items.
 */
export function ListsScreen({ params }: ScreenProps<{ collections?: 'none' }>) {
  const nav = useNav();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // the Create sheet's card lotties and the FTUX explainer lottie are fetched here, so they are cached before the sheet opens
  useEffect(() => (prepareHaptics(), warmLottie(colLottie, regLottie, ftuxLottie), nav.preload('giftregistry/create', 'giftregistry/steps')), []);
  return (
    <WishlistScreen
      params={params}
      title={copy.lists.title}
      onCreate={() => (haptics.tap(), nav.sheet('giftregistry/create'))}
      lead={<RegistryStrip />}
      collections={[]}
      items={savedItems}
      hideCartPill
    />
  );
}
