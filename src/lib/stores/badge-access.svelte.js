/**
 * Badge Access Store
 * Reactive store for checking badge-based access control within a community
 */

import { eventStore, pool } from '$lib/stores/nostr-infrastructure.svelte.js';
import { createUserAwardsLoader } from '$lib/loaders/badge-loaders.js';
import { UserAwardsModel } from '$lib/models/badge-model.js';
import { getWriteRelays } from '$lib/services/relay-service.svelte.js';
import { manager } from '$lib/stores/accounts.svelte';

/**
 * @typedef {Object} ContentTypeConfig
 * @property {string} name
 * @property {number[]} kinds
 * @property {boolean} exclusive
 * @property {string[]} roles
 * @property {{amount: string, unit: string}=} fee
 * @property {{read: string|null, write: string|null}} badges
 * @property {string[]} relays
 */

/**
 * Parse content types from a community event
 * Inline parser to avoid circular dependencies
 * @param {any} event - The kind 10222 community event
 * @returns {ContentTypeConfig[]}
 */
function parseCommunityContentTypes(event) {
	/** @type {ContentTypeConfig[]} */
	const contentTypes = [];
	/** @type {ContentTypeConfig|null} */
	let currentContentType = null;

	if (!event || !Array.isArray(event.tags)) return contentTypes;

	for (const tag of event.tags) {
		if (!Array.isArray(tag) || tag.length === 0) continue;
		const key = tag[0];

		if (key === 'content') {
			if (currentContentType) contentTypes.push(currentContentType);
			currentContentType = {
				name: tag[1],
				kinds: [],
				exclusive: false,
				roles: [],
				badges: { read: null, write: null },
				relays: []
			};
		} else if (key === 'k' && currentContentType) {
			const kind = parseInt(tag[1], 10);
			if (!Number.isNaN(kind)) currentContentType.kinds.push(kind);
		} else if (key === 'fee' && currentContentType) {
			currentContentType.fee = { amount: tag[1], unit: tag[2] || 'sat' };
		} else if (key === 'exclusive' && currentContentType) {
			currentContentType.exclusive = tag[1] === 'true';
		} else if (key === 'role' && currentContentType) {
			currentContentType.roles = tag.slice(1);
		} else if (key === 'a' && currentContentType && tag[1]?.startsWith('30009:')) {
			const qualifier = tag[2] || 'write';
			if (qualifier === 'read') {
				currentContentType.badges.read = tag[1];
			} else {
				currentContentType.badges.write = tag[1];
			}
		} else if (key === 'r' && currentContentType && tag[2] === 'content') {
			currentContentType.relays.push(tag[1]);
		}
	}

	if (currentContentType) contentTypes.push(currentContentType);
	return contentTypes;
}

/**
 * Create reactive badge access checker for a community
 * @param {() => any} getCommunityEvent - Function that returns the community event (for reactivity)
 * @returns {{
 *   accessMap: Map<string, {read: boolean, write: boolean}>,
 *   isLoading: boolean,
 *   canRead: (contentTypeName: string) => boolean,
 *   canWrite: (contentTypeName: string) => boolean,
 *   hasBadge: (badgeAddress: string) => boolean
 * }}
 */
export function useBadgeAccess(getCommunityEvent) {
	let accessMap = $state(/** @type {Map<string, {read: boolean, write: boolean}>} */ (new Map()));
	let userBadges = $state(/** @type {Set<string>} */ (new Set()));
	let isLoading = $state(true);

	// Store subscriptions for cleanup
	/** @type {import('rxjs').Subscription | undefined} */
	let loaderSub;
	/** @type {import('rxjs').Subscription | undefined} */
	let modelSub;

	$effect(() => {
		const communityEvent = getCommunityEvent();
		const userPubkey = manager.active?.pubkey;

		if (!userPubkey || !communityEvent) {
			isLoading = false;
			accessMap = new Map();
			userBadges = new Set();
			return;
		}

		isLoading = true;

		// Use NIP-65 outbox model to discover user's write relays
		getWriteRelays(userPubkey).then((relays) => {
			// Start loader to fetch user's badge awards
			const loader = createUserAwardsLoader(pool, relays, eventStore, userPubkey);
			loaderSub = loader()().subscribe();

			// Subscribe to model for reactive updates
			modelSub = eventStore.model(UserAwardsModel, userPubkey).subscribe((awards) => {
				// Build set of badge addresses the user holds
				const awardAddresses = new Set(awards.map((a) => a.badgeAddress).filter(Boolean));
				userBadges = awardAddresses;

				// Parse content types from community event
				const contentTypes = parseCommunityContentTypes(communityEvent);
				const newMap = new Map();

				for (const ct of contentTypes) {
					const canRead = !ct.badges?.read || awardAddresses.has(ct.badges.read);
					const canWrite = !ct.badges?.write || awardAddresses.has(ct.badges.write);
					newMap.set(ct.name, { read: canRead, write: canWrite });
				}

				accessMap = newMap;
				isLoading = false;
			});
		});

		return () => {
			loaderSub?.unsubscribe();
			modelSub?.unsubscribe();
		};
	});

	return {
		get accessMap() {
			return accessMap;
		},
		get isLoading() {
			return isLoading;
		},
		/**
		 * Check if user can read a specific content type
		 * @param {string} contentTypeName
		 * @returns {boolean}
		 */
		canRead: (contentTypeName) => accessMap.get(contentTypeName)?.read ?? true,
		/**
		 * Check if user can write to a specific content type
		 * @param {string} contentTypeName
		 * @returns {boolean}
		 */
		canWrite: (contentTypeName) => accessMap.get(contentTypeName)?.write ?? true,
		/**
		 * Check if user holds a specific badge
		 * @param {string} badgeAddress
		 * @returns {boolean}
		 */
		hasBadge: (badgeAddress) => userBadges.has(badgeAddress)
	};
}

/**
 * Create a simple badge holder checker (non-reactive, for one-time checks)
 * @param {string} userPubkey - The user to check
 * @returns {Promise<Set<string>>} Set of badge addresses the user holds
 */
export async function loadUserBadges(userPubkey) {
	if (!userPubkey) {
		return new Set();
	}

	// Use NIP-65 outbox model to discover user's write relays
	const relays = await getWriteRelays(userPubkey);

	return new Promise((resolve) => {
		const loader = createUserAwardsLoader(pool, relays, eventStore, userPubkey);
		const loaderSub = loader()().subscribe();

		// Give some time for events to load
		setTimeout(() => {
			const modelSub = eventStore.model(UserAwardsModel, userPubkey).subscribe((awards) => {
				const badges = new Set(awards.map((a) => a.badgeAddress).filter(Boolean));
				modelSub.unsubscribe();
				loaderSub?.unsubscribe();
				resolve(badges);
			});
		}, 1000);
	});
}
