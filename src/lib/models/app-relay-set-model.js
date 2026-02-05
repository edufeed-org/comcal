/**
 * App Relay Set Model - transforms kind 30002 events into relay configurations
 * For NIP-51 relay sets with app-specific d-tags
 */
import { map, distinctUntilChanged } from 'rxjs/operators';
import { getRelaySetDTag, parseRelaySetEvent } from '$lib/services/app-relay-service.svelte.js';

/**
 * Model for app-specific relay set (kind 30002)
 * @param {string} pubkey - User's pubkey
 * @param {string} category - Category name ('calendar', 'communikey', 'educational')
 * @returns {Function} Model function that takes eventStore
 */
export function AppRelaySetModel(pubkey, category) {
	const dTag = getRelaySetDTag(category);

	return (eventStore) =>
		eventStore.replaceable(30002, pubkey, dTag).pipe(
			map((event) => {
				const relays = parseRelaySetEvent(event);

				return {
					category,
					relays,
					hasOverride: relays.length > 0,
					rawEvent: event || null
				};
			}),
			distinctUntilChanged((a, b) => JSON.stringify(a.relays) === JSON.stringify(b.relays))
		);
}

/**
 * @typedef {Object} AppRelaySetResult
 * @property {string} category - Category name
 * @property {string[]} relays - Array of relay URLs
 * @property {boolean} hasOverride - Whether user has a custom relay set
 * @property {Object|null} rawEvent - The raw kind 30002 event
 */
