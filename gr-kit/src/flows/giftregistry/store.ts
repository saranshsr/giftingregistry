import { createStore } from '../../kit/createStore';
import type { OccasionKey } from './tokens';

export interface Registry {
  id: number;
  name: string;
  occasion: OccasionKey;
  /** ddmmyyyy */
  date: string;
  /** it has already ridden into the My Lists strip */
  shown?: boolean;
}

export interface GiftRegistryState {
  /** answers of the creation flow */
  occ: OccasionKey | null;
  name: string;
  regName: string;
  regEdited: boolean;
  /** ddmmyyyy typed so far */
  digits: string;
  address: string;
  leaveAtDoor: boolean;
  /** registries made in this session, newest first (My Lists strip) */
  created: Registry[];
  /** the newest one still has to ride into the strip */
  pendingArrival: number | null;
  /** the Account card intro runs once per visit to the flow (Restart runs it again) */
  introPlayed: boolean;
  /** performance.now() when the Account card's teaser actually started (after its art decoded); the help pill folds 1 s later */
  introStartedAt: number | null;
  /** set when the calendar sheet confirms a date: the date step moves on once the sheet has closed */
  dateConfirmedAt: number | null;
}

const fresh = () => ({ occ: null, name: '', regName: '', regEdited: false, digits: '', address: 'home', leaveAtDoor: false });

export const grStore = createStore<GiftRegistryState>({ ...fresh(), created: [], pendingArrival: null, introPlayed: false, introStartedAt: null, dateConfirmedAt: null });

/** a new creation run starts empty */
export const resetAnswers = () => grStore.patch(fresh());
