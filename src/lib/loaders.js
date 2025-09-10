import { createAddressLoader, createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, relays, eventStore } from '$lib/store.svelte';

export const addressLoader = createAddressLoader(pool, { eventStore, lookupRelays: relays });

eventStore.addressableLoader = addressLoader;
eventStore.replaceableLoader = addressLoader;
