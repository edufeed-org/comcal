/**
 * Article loading utilities for kind 30023 long-form content.
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { runtimeConfig } from '$lib/stores/config.svelte.js';

/**
 * Get relays for articles (uses fallback relays)
 * @returns {string[]}
 */
function getArticleRelays() {
	return runtimeConfig.fallbackRelays || [];
}

/**
 * Factory: Create a stateful timeline loader for kind 30023 articles with automatic pagination
 * The returned loader function automatically tracks state and fetches the next chronological block on each call
 * @param {number} limit - Maximum number of articles to load per batch
 * @returns {Function} Stateful timeline loader function (call with no args, returns Observable)
 */
export function articleTimelineLoader(limit = 20) {
	return createTimelineLoader(
		pool,
		getArticleRelays(),
		{ kinds: [30023] },
		{ eventStore, limit }
	);
}
