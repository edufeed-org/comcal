/**
 * Comment loader for NIP-22 comments
 * Provides a factory for creating timeline loaders specific to event comments
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { runtimeConfig } from '$lib/stores/config.svelte.js';

/**
 * Factory: Create a comment loader for a specific event
 * 
 * This loader fetches all NIP-22 comments (kind 1111) that reference
 * a specific event via the uppercase 'A' tag (root scope).
 * 
 * @param {string} eventAddress - The event address in format "kind:pubkey:dtag"
 * @returns {Function} Timeline loader function that returns an Observable
 * 
 * @example
 * // Create a loader for an event's comments
 * const commentLoader = createCommentLoader('31923:pubkey123:event-id');
 * 
 * // Load comments - each call loads the next page
 * commentLoader().subscribe(comment => {
 *   console.log('Received comment:', comment);
 * });
 * 
 * // Load older comments
 * commentLoader().subscribe(comment => {
 *   console.log('Received older comment:', comment);
 * });
 */
export const createCommentLoader = (eventAddress) => {
	if (!eventAddress) {
		throw new Error('Event address is required to create comment loader');
	}

	return createTimelineLoader(
		pool,
		runtimeConfig.calendar.defaultRelays,
		{
			kinds: [1111], // NIP-22 comments
			'#A': [eventAddress], // Comments for this specific event (root scope)
			limit: 100 // Load 100 comments per page
		},
		{ eventStore }
	);
};
