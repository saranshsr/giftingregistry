import type { OccasionKey } from './tokens';

/**
 * Copy and mock content for the Gift Registry creation flow. Source of truth: the flow prototype built from Figma
 * Zs6qEAZ1Uaej4LcKst0sbp · 843:719902 (flow-proto/ index.html + app.js), and the reference prototype (flow 6) for the
 * Account card, the Create sheet cards, the address list and the leave-at-door row.
 */

export interface Occasion {
  key: OccasionKey;
  /** tile label */
  label: string;
  /** word used in "Whose <x> is it?" and the registry name */
  name: string;
  /** lottie file suffix (Mother's day has no set of its own: it plays Other) */
  file: string;
}

export const occasions: Occasion[] = [
  { key: 'eid', label: 'Eid-ul-fitr', name: 'Eid ul fitr', file: 'eid' },
  { key: 'birthday', label: 'Birthday', name: 'Birthday', file: 'birthday' },
  { key: 'babyshower', label: 'Baby shower', name: 'Baby shower', file: 'baby-shower' },
  { key: 'mothersday', label: 'Mother’s day', name: 'Mother’s day', file: 'other' },
  { key: 'wedding', label: 'Wedding', name: 'Wedding', file: 'wedding' },
  { key: 'housewarming', label: 'House warming', name: 'House warming', file: 'house-warming' },
  { key: 'anniversary', label: 'Anniversary', name: 'Anniversary', file: 'anniversary' },
  { key: 'other', label: 'Other', name: 'Celebration', file: 'other' },
];
export const occasionOf = (k: OccasionKey) => occasions.find((o) => o.key === k)!;

export type StepId = 'occ' | 'whose' | 'name' | 'when' | 'due' | 'deliv';

/** lottie = the hero comp per step; progress = fill of the 72pt bar (Figma); kb = which keyboard rides under the CTA */
export const steps: Record<StepId, { lottie: string; progress: number; kb: 'none' | 'text' | 'num'; cta?: string; title: (o: Occasion | null) => string }> = {
  occ: { lottie: '1-1-occasion', progress: 14, kb: 'none', title: () => 'Occasion?' },
  whose: { lottie: '2-3-whose-is-it', progress: 44, kb: 'text', title: (o) => `Whose ${o ? o.name.toLowerCase() : 'occasion'} is it?` },
  name: { lottie: 'name-your-registry', progress: 48, kb: 'text', title: () => 'Name your registry' },
  when: { lottie: '1-3-when-is-it', progress: 51, kb: 'num', title: () => 'When is it?' },
  due: { lottie: '2-5-due-date', progress: 56, kb: 'num', title: () => 'Due date' },
  deliv: { lottie: '1-4-delivery-details', progress: 64, kb: 'none', cta: 'Create', title: () => 'Delivery details' },
};

export const flowSteps = (occ: OccasionKey | null): StepId[] => ['occ', 'whose', 'name', occ === 'babyshower' ? 'due' : 'when', 'deliv'];

export const copy = {
  account: {
    myLists: 'My Lists',
    myListsSub: 'Wish lists and Gift registries',
    registries: 'Gift Registries',
    registriesSub: 'Share & get gifts you want',
    newTag: 'NEW',
  },
  lists: { title: 'My Lists', create: 'Create', registryCard: 'Gift registry', registryCardSub: 'Share & get gifts' },
  create: {
    collection: { title: 'Create new collection', sub: 'Organise & save for later' },
    registry: { title: 'Create your gift registry', sub: 'Share & track gifts you want' },
    newTag: 'NEW',
    collectionToast: 'Collections aren’t in this prototype',
  },
  explainer: {
    title: 'What is a Gift Registry?',
    cols: [
      { lead: 'Create & ', bold: 'add items', tail: ' you want' },
      { lead: '', bold: 'Share it', tail: ' with your family & friends' },
      { lead: '', bold: 'Track your gifts', tail: ' as they come' },
    ],
    cta: 'Continue',
  },
  steps: {
    namePlaceholder: 'Name',
    registryPlaceholder: 'Registry name',
    pickFromCalendar: 'Pick from calendar',
    continue: 'Continue',
    note: { bold: 'This can’t be changed later.', rest: ' Your address stays private.' },
    instructions: 'Delivery instructions',
    leaveAtDoor: 'Leave at door',
    errors: {
      occ: 'Pick an occasion first',
      whose: 'Add a name first',
      name: 'Give your registry a name',
      date: 'Add the date',
      due: 'Add the due date',
      invalid: 'That date doesn’t exist',
    },
  },
  calendar: { title: 'When is the event?', confirm: 'Confirm', close: 'Close' },
  address: {
    search: 'Search for area, street name…',
    location: { title: 'Enable location', hint: 'Location helps us deliver faster' },
    enable: 'Enable',
    add: 'Add new address',
  },
  created: (name: string) => `“${name}” created`,
};

/** "<Name>'s <Occasion>" prefill (flow-proto stepTo) */
export const registryName = (who: string, o: Occasion) => `${who.trim()}’s ${o.name}`;

export interface Address {
  key: string;
  title: string;
  line: string;
  contact: string;
  icon: 'home' | 'work' | 'location';
}
const BURJ = 'Burj Khalifa, 1 Sheikh Mohammed bin Rashid Blvd, Downtown Dubai';
/** the default card (flow-proto) + the reference's saved addresses (Figma "Address edit" 1407:1700960) */
export const addresses: Address[] = [
  { key: 'home', title: 'Home', line: '676D, Downtown, Dubai', contact: '{name}  •  +971 (0) 412 3456', icon: 'home' },
  { key: 'work', title: 'Work', line: BURJ, contact: 'Ahmed Ali  •  +971-50 789 3456', icon: 'work' },
  { key: 'ayush', title: 'Ayush’s Dubai Place', line: BURJ, contact: 'Ahmed Ali  •  +971-50 789 3456', icon: 'location' },
];

/** the profile name used when nothing was typed (flow-proto) */
export const defaultName = 'Prasanna';
