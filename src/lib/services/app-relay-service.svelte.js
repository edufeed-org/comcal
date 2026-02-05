/**
 * App Relay Service - NIP-51 Relay Sets for app-specific relays
 *
 * Users can override app relays via kind 30002 events with app-specific d-tags.
 * D-tags are based on APP_NAME from config (e.g., "ComCal/calendar")
 */
import { runtimeConfig } from '$lib/stores/config.svelte.js';

/**
 * App relay categories with their associated event kinds
 */
export const CATEGORIES = {
	calendar: {
		kinds: [31922, 31923, 31924, 31925],
		label: 'Calendar Events'
	},
	communikey: {
		kinds: [10222, 30222, 30382],
		label: 'Community Events'
	},
	educational: {
		kinds: [30142],
		label: 'Educational Resources'
	},
	longform: {
		kinds: [30023],
		label: 'Articles & Long-form Content'
	}
};

/**
 * Get d-tag for a category based on APP_NAME from config
 * Example: APP_NAME="ComCal" → "ComCal/calendar"
 * @param {string} category - 'calendar' | 'communikey' | 'educational'
 * @returns {string}
 */
export function getRelaySetDTag(category) {
	const appName = runtimeConfig.appName || 'ComCal';
	return `${appName}/${category}`;
}

/**
 * Reactive cache for user's relay set overrides (populated by subscriptions).
 * Uses $state so Svelte $derived expressions re-evaluate when cache changes.
 * @type {Map<string, string[]>}
 */
let userOverrideCache = $state(new Map());

/**
 * Update the cache for a category (called from subscription in settings page)
 * @param {string} category - Category name
 * @param {string[]} relays - Relay URLs
 */
export function updateUserOverrideCache(category, relays) {
	const next = new Map(userOverrideCache);
	next.set(category, relays);
	userOverrideCache = next;
}

/**
 * Clear the cache (on logout)
 */
export function clearUserOverrideCache() {
	userOverrideCache = new Map();
}

/**
 * Get user's relay set override from cache
 * @param {string} category - 'calendar' | 'communikey' | 'educational'
 * @returns {string[]} Relay URLs from user's relay set, or empty array
 */
export function getUserRelaySetOverride(category) {
	return userOverrideCache.get(category) || [];
}

/**
 * Get server default relays for a category
 * @param {string} category - 'calendar' | 'communikey' | 'educational' | 'longform'
 * @returns {string[]}
 */
export function getDefaultRelaysForCategory(category) {
	switch (category) {
		case 'calendar':
			return runtimeConfig.appRelays?.calendar || [];
		case 'communikey':
			return runtimeConfig.appRelays?.communikey || [];
		case 'educational':
			return runtimeConfig.appRelays?.educational || [];
		case 'longform':
			return runtimeConfig.appRelays?.longform || [];
		default:
			return [];
	}
}

/**
 * Get effective app relays for category (user override or server default)
 * @param {string} category - 'calendar' | 'communikey' | 'educational'
 * @returns {string[]}
 */
export function getAppRelaysForCategory(category) {
	// Check for user's kind 30002 relay set override
	const userOverride = getUserRelaySetOverride(category);
	if (userOverride.length > 0) {
		return userOverride;
	}

	// Fall back to server defaults
	return getDefaultRelaysForCategory(category);
}

/**
 * Check if user has a relay set override for a category
 * @param {string} category - Category name
 * @returns {boolean}
 */
export function hasOverrideForCategory(category) {
	return getUserRelaySetOverride(category).length > 0;
}

/**
 * Map event kind to app relay category
 * @param {number} kind - Nostr event kind
 * @returns {string|null} Category name or null if not an app relay kind
 */
export function kindToAppRelayCategory(kind) {
	if ([31922, 31923, 31924, 31925].includes(kind)) return 'calendar';
	if ([10222, 30222, 30382].includes(kind)) return 'communikey';
	if ([30142].includes(kind)) return 'educational';
	if ([30023].includes(kind)) return 'longform';
	return null;
}

/**
 * Parse relay URLs from a kind 30002 event
 * @param {Object|null} event - Kind 30002 event
 * @returns {string[]} Array of relay URLs
 */
export function parseRelaySetEvent(event) {
	if (!event?.tags) return [];

	return event.tags
		.filter((t) => t[0] === 'relay')
		.map((t) => t[1])
		.filter(Boolean);
}
