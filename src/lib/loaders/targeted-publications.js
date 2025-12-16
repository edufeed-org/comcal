/**
 * Targeted Publications Loader
 * Loads kind 30222 events that share content with communities
 * 
 * Targeted publications have:
 * - 'p' tag: target community pubkey
 * - 'k' tag: kind of referenced content
 * - 'a' or 'e' tag: reference to the actual content
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { appConfig } from '$lib/config.js';

/**
 * Create a timeline loader for all targeted publications (kind 30222)
 * Loads shares for articles, AMB resources, and calendar events
 * @param {number} limit - Maximum number of events to load per batch
 * @returns {Function} Stateful timeline loader function
 */
export function allTargetedPublicationsLoader(limit = 200) {
	return createTimelineLoader(
		pool,
		appConfig.calendar.defaultRelays,
		{ kinds: [30222] },
		{ eventStore, limit }
	);
}

/**
 * Create a timeline loader for article-specific targeted publications
 * @param {number} limit - Maximum number of events to load per batch
 * @returns {Function} Stateful timeline loader function
 */
export function articleTargetedPublicationsLoader(limit = 100) {
	return createTimelineLoader(
		pool,
		appConfig.calendar.defaultRelays,
		{ 
			kinds: [30222],
			'#k': ['30023'] // Only article shares
		},
		{ eventStore, limit }
	);
}

/**
 * Create a timeline loader for AMB resource-specific targeted publications
 * @param {number} limit - Maximum number of events to load per batch
 * @returns {Function} Stateful timeline loader function
 */
export function ambTargetedPublicationsLoader(limit = 100) {
	return createTimelineLoader(
		pool,
		appConfig.calendar.defaultRelays,
		{ 
			kinds: [30222],
			'#k': ['30142'] // Only AMB resource shares
		},
		{ eventStore, limit }
	);
}

/**
 * Create a timeline loader for feed content targeted publications
 * Loads shares for both articles (30023) and AMB resources (30142)
 * @param {number} limit - Maximum number of events to load per batch
 * @returns {Function} Stateful timeline loader function
 */
export function feedTargetedPublicationsLoader(limit = 200) {
	return createTimelineLoader(
		pool,
		appConfig.calendar.defaultRelays,
		{ 
			kinds: [30222],
			'#k': ['30023', '30142'] // Articles and AMB resources
		},
		{ eventStore, limit }
	);
}
