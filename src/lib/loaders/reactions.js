/**
 * Reactions loader for NIP-25 reactions
 * Provides a singleton reactions loader for the application
 */
import { createReactionsLoader } from 'applesauce-loaders/loaders';
import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';

/**
 * Application-level reactions loader
 * 
 * This loader fetches all NIP-25 reactions (kind 7) for any given event.
 * It automatically handles both regular events and addressable events.
 * 
 * @example
 * // Load reactions for an event
 * reactionsLoader(event, relays).subscribe(reaction => {
 *   console.log('Received reaction:', reaction);
 * });
 */
export const reactionsLoader = createReactionsLoader(pool, {
	useSeenRelays: true,
	eventStore,
	bufferTime: 1000
});
