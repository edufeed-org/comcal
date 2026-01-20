/**
 * Base loaders that bootstrap EventStore with relay knowledge.
 * These must be created before EventStore can intelligently fetch data.
 * 
 * The loaders connect the EventStore to the relay pool, enabling automatic
 * data fetching without explicit configuration in each component.
 */
import { createAddressLoader, createEventLoader, createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { getAllLookupRelays, getCalendarRelays } from '$lib/helpers/relay-helper.js';

// Bootstrap EventStore - gives it relay knowledge
// Uses a getter function for lookupRelays to ensure config updates are reflected
export const addressLoader = createAddressLoader(pool, {
	eventStore,
	get lookupRelays() {
		return getAllLookupRelays();
	}
});

// Connect loaders to EventStore for automatic fetching
eventStore.addressableLoader = addressLoader;
eventStore.replaceableLoader = addressLoader;

// Event resolution loader for fetching specific events by ID
export const eventLoader = createEventLoader(pool, { eventStore });

/**
 * Factory: Create a timeline loader for user's deletion events (NIP-09)
 * This is a general-purpose deletion loader that can be used for any deletable content.
 * 
 * @param {string} userPubkey - The pubkey of the user whose deletions to load
 * @returns {Function} Timeline loader function that returns an Observable
 * 
 * @example
 * // Load a user's deletion events
 * const deletionLoader = userDeletionLoader(userPubkey);
 * deletionLoader().subscribe(deletionEvent => {
 *   // Process deletion event
 *   console.log('Deletion event:', deletionEvent);
 * });
 */
export const userDeletionLoader = (userPubkey) => createTimelineLoader(
	pool,
	getCalendarRelays(),
	{
		kinds: [5],              // NIP-09 deletion events
		authors: [userPubkey],   // User's own deletions
		limit: 500               // Higher limit since deletions accumulate over time
	},
	{ eventStore }
);
