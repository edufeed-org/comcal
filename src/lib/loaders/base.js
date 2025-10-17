/**
 * Base loaders that bootstrap EventStore with relay knowledge.
 * These must be created before EventStore can intelligently fetch data.
 * 
 * The loaders connect the EventStore to the relay pool, enabling automatic
 * data fetching without explicit configuration in each component.
 */
import { createAddressLoader, createEventLoader } from 'applesauce-loaders/loaders';
import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { appConfig } from '$lib/config.js';

// Bootstrap EventStore - gives it relay knowledge
export const addressLoader = createAddressLoader(pool, { 
	eventStore, 
	lookupRelays: appConfig.calendar.defaultRelays 
});

// Connect loaders to EventStore for automatic fetching
eventStore.addressableLoader = addressLoader;
eventStore.replaceableLoader = addressLoader;

// Event resolution loader for fetching specific events by ID
export const eventLoader = createEventLoader(pool, { eventStore });
