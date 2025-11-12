/**
 * AMB resource loading utilities for kind 30142 educational resources.
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { appConfig } from '$lib/config.js';

/**
 * Factory: Create a stateful timeline loader for kind 30142 AMB resources with automatic pagination
 * The returned loader function automatically tracks state and fetches the next chronological block on each call
 * @param {number} limit - Maximum number of resources to load per batch
 * @returns {Function} Stateful timeline loader function (call with no args, returns Observable)
 */
export function ambTimelineLoader(limit = 20) {
	return createTimelineLoader(
		pool,
		appConfig.calendar.defaultRelays,
		{ kinds: [30142] },
		{ eventStore, limit }
	);
}
