import { createAddressLoader, createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, relays, eventStore } from '$lib/store.svelte';

export const addressLoader = createAddressLoader(pool, { eventStore, lookupRelays: relays });
export const communikeyTimelineLoader = createTimelineLoader(
  pool,
  relays,
  { 
    kinds: [10222] 
  },
  { eventStore });

eventStore.addressableLoader = addressLoader;
eventStore.replaceableLoader = addressLoader;
