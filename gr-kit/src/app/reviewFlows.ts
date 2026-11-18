import type { Route } from '../kit/types';

/**
 * The review page's flow list (dev preview only): the Gift Registry prototype's flows, in the reference's groups and
 * order. An entry is live as soon as its `route` resolves in the registry (register the flow in src/flows/index.ts);
 * until then the selector shows it as "Coming next".
 */
export interface ReviewFlow {
  id: string;
  title: string;
  subtitle: string;
  /** where the entry opens: `flow/screen` (the flow's start for this variant) */
  route: Route;
}

export const reviewTitle = 'Gift Registry';

export const reviewGroups: { label: string; flows: ReviewFlow[] }[] = [
  {
    label: 'Receiver',
    flows: [
      { id: '01', title: '01 · Gift Registry creation', subtitle: 'Option 3 · finalised', route: 'giftregistry/account' },
      { id: '03a', title: '03a · Saving an item to a gift list', subtitle: 'With a size variant', route: 'giftsave/size' },
      { id: '03b', title: '03b · Saving an item to a gift list', subtitle: 'Without a size variant', route: 'giftsave/nosize' },
      { id: '04', title: '04 · Receiver flow', subtitle: 'Gift list, tracking, settings', route: 'grreceiver' },
    ],
  },
  {
    label: 'Gift giver',
    flows: [
      { id: '05', title: '05 · Gift giver flow', subtitle: 'Gift bag to checkout', route: 'grgifter' },
      { id: '06', title: '06 · PDP', subtitle: 'Explorable product cards', route: 'grgifter/pdp' },
    ],
  },
];
