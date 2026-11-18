import { defineFlow } from '../../kit/registry';
import { lazyScreen } from '../../kit/lazyScreen';
import { giftregistryFlowTokens } from './tokens';
import './transitions';
import { haptics } from './haptics';
import { SHEET_OPEN } from './motion';

/** nano: a sheet swiped away plays `swipe`; one let go short of closing, `aborted` */
const dragRelease = (dismissed: boolean) => (dismissed ? haptics.swipe() : haptics.aborted());

const AccountScreen = lazyScreen(() => import('./AccountScreen'), 'AccountScreen');
const ListsScreen = lazyScreen(() => import('./ListsScreen'), 'ListsScreen');
const CreateSheet = lazyScreen(() => import('./CreateSheet'), 'CreateSheet');
const StepsScreen = lazyScreen(() => import('./StepsScreen'), 'StepsScreen');
const RegistryScreen = lazyScreen(() => import('./RegistryScreen'), 'RegistryScreen');
const AddressSheet = lazyScreen(() => import('./AddressSheet'), 'AddressSheet');

const FIGMA = 'Figma Zs6qEAZ1Uaej4LcKst0sbp';
const REF = 'reference: gifting-registry-noon.vercel.app/v4 (flow 6)';

export const giftregistryFlow = defineFlow({
  id: 'giftregistry',
  title: 'Gift Registry',
  group: 'Gift Registry',
  description:
    '01 · Gift Registry creation (Option 3, finalised): Account (live kit page, Gift Registries teaser) → My Lists (kit wishlist) → Create sheet → What is a Gift Registry → Occasion, Whose, Name, When / Due date, Delivery → back on My Lists with the new registry.',
  initial: 'account',
  tokens: giftregistryFlowTokens,
  // a sheet opened by URL sits on My Lists
  sheetBackdrop: 'giftregistry/lists',
  tabBar: { tab: 'account', screens: ['account'] },
  screens: [
    {
      id: 'account',
      title: 'Account',
      component: AccountScreen,
      path: ['gift-registry'],
      notes:
        'The live kit Account. As it lands, the My Lists card runs its Gift Registries teaser (thumbnails gather, the promo rises with NEW and a shimmer, then drops away) and "Need help?" folds at 2.6 s. Tap the card → My Lists.',
      source: `${REF} widget.js states 01–05 · kit src/flows/account`,
      truth: 'reference',
    },
    {
      id: 'lists',
      title: 'My Lists',
      component: ListsScreen,
      transition: 'gr-push',
      parent: 'giftregistry/account',
      notes:
        'The kit Wishlist titled My Lists. "+ Create" (or the Gift registry card) opens the Create sheet. After Create, the new registry rides in at the front of the strip with a toast.',
      source: `${FIGMA} · 843:720073 · kit src/flows/wishlist`,
      truth: 'mixed',
    },
    {
      id: 'create',
      title: 'Create · What is a Gift Registry',
      component: CreateSheet,
      presentation: 'sheet',
      sheet: { dragScrim: true, dissolveOnReplace: true, onDragRelease: dragRelease, openSpring: SHEET_OPEN },
      parent: 'giftregistry/lists',
      notes:
        'Card art pops in piece by piece. "Create your gift registry" grows the sheet into the explainer in place; Continue grows the white card into the first step. Drag down: the scrim follows; past 30% (or a flick) it closes.',
      source: `${FIGMA} · 843:756638, 843:763414 · ${REF} buildSheetCard / expandCreateSheet / morphToRegistry`,
      truth: 'mixed',
    },
    {
      id: 'steps',
      title: 'Registry steps',
      component: StepsScreen,
      presentation: 'modal',
      transition: 'gr-flow',
      parent: 'giftregistry/lists',
      notes:
        'Pick an occasion: the page and ribbon recolour at once. Type a name (the registry name prefills "<Name>’s <Occasion>"), a date on the pad (or Pick from calendar), check the delivery card (tap it for the address sheet) and Create. Empty answers shake the CTA with a toast.',
      source: `${FIGMA} · 843:719902 (1.1, 2.3, Name, 1.3 / 2.5, 1.4)`,
      truth: 'figma',
    },
    {
      id: 'registry',
      title: 'Gift registry',
      component: RegistryScreen,
      transition: 'gr-reveal',
      statusBar: 'light',
      parent: 'giftregistry/lists',
      notes:
        'Where Create lands: the occasion header with the registry name and countdown, the empty state, Find gifts to add, and the sticky Explore curated gifts strip. Back goes to My Lists, where the new card rides in.',
      source: `${FIGMA} · 843:723290`,
      truth: 'figma',
    },
    {
      id: 'address',
      title: 'Delivery address',
      component: AddressSheet,
      presentation: 'sheet',
      sheet: { dragScrim: true, onDragRelease: dragRelease, openSpring: SHEET_OPEN },
      parent: 'giftregistry/steps',
      notes: 'Pick a saved address: the radio lands, the sheet closes, the delivery card fades to it.',
      source: `${REF} buildAddressSheet`,
      truth: 'reference',
    },
  ],
});
