/**
 * Badge Access Validation Helpers
 * Utilities for checking if users have required badges for content access
 */

import { eventStore, pool } from '$lib/stores/nostr-infrastructure.svelte.js';
import { createUserAwardsLoader } from '$lib/loaders/badge-loaders.js';
import { UserAwardsModel } from '$lib/models/badge-model.js';
import { getWriteRelays } from '$lib/services/relay-service.svelte.js';
import { firstValueFrom, filter, take, timeout } from 'rxjs';

/**
 * Check if a user holds a specific badge
 * @param {string} badgeAddress - Badge address in format "30009:pubkey:badge-id"
 * @param {string} userPubkey - The user to check
 * @param {number} [timeoutMs=5000] - Timeout in milliseconds
 * @returns {Promise<boolean>} Whether the user holds the badge
 */
export async function userHoldsBadge(badgeAddress, userPubkey, timeoutMs = 5000) {
	if (!badgeAddress || !userPubkey) {
		return false;
	}

	// Extract issuer pubkey from badge address (format: "30009:issuerPubkey:badgeId")
	const issuerPubkey = badgeAddress.split(':')[1];

	// Use NIP-65 outbox model to discover issuer's write relays (where awards are published)
	const relays = await getWriteRelays(issuerPubkey || userPubkey);

	// Start loader to fetch awards from relays
	const loader = createUserAwardsLoader(pool, relays, eventStore, userPubkey);
	const loaderSub = loader()().subscribe();

	try {
		// Wait for model to emit (with timeout)
		const awards = await firstValueFrom(
			eventStore.model(UserAwardsModel, userPubkey).pipe(
				filter((a) => a.length >= 0),
				take(1),
				timeout(timeoutMs)
			)
		);

		loaderSub.unsubscribe();
		return awards.some((award) => award.badgeAddress === badgeAddress);
	} catch {
		loaderSub.unsubscribe();
		return false;
	}
}

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
 * @typedef {Object} AccessCheckResult
 * @property {boolean} allowed - Whether access is granted
 * @property {string|null} badge - The badge address that is required (if any)
 */

/**
 * Check access for a content type
 * @param {ContentTypeConfig} contentType - The content type configuration
 * @param {string} userPubkey - The user to check
 * @param {'read'|'write'} accessType - Type of access to check
 * @param {number} [timeoutMs=5000] - Timeout in milliseconds
 * @returns {Promise<AccessCheckResult>}
 */
export async function checkContentAccess(contentType, userPubkey, accessType, timeoutMs = 5000) {
	const requiredBadge = contentType.badges?.[accessType];

	if (!requiredBadge) {
		return { allowed: true, badge: null };
	}

	if (!userPubkey) {
		return { allowed: false, badge: requiredBadge };
	}

	const hasBadge = await userHoldsBadge(requiredBadge, userPubkey, timeoutMs);

	return {
		allowed: hasBadge,
		badge: requiredBadge
	};
}

/**
 * Get all badges held by a user
 * @param {string} userPubkey - The user to check
 * @param {number} [timeoutMs=5000] - Timeout in milliseconds
 * @returns {Promise<Set<string>>} Set of badge addresses the user holds
 */
export async function getUserBadges(userPubkey, timeoutMs = 5000) {
	if (!userPubkey) {
		return new Set();
	}

	// Use NIP-65 outbox model to discover user's read relays (where they receive awards)
	const relays = await getWriteRelays(userPubkey);

	// Start loader to fetch awards from relays
	const loader = createUserAwardsLoader(pool, relays, eventStore, userPubkey);
	const loaderSub = loader()().subscribe();

	try {
		const awards = await firstValueFrom(
			eventStore.model(UserAwardsModel, userPubkey).pipe(
				filter((a) => a.length >= 0),
				take(1),
				timeout(timeoutMs)
			)
		);

		loaderSub.unsubscribe();
		return new Set(awards.map((award) => award.badgeAddress).filter(Boolean));
	} catch {
		loaderSub.unsubscribe();
		return new Set();
	}
}

/**
 * Check multiple content types at once for a user
 * @param {ContentTypeConfig[]} contentTypes - Array of content type configurations
 * @param {string} userPubkey - The user to check
 * @returns {Promise<Map<string, {read: boolean, write: boolean}>>} Map of content type name to access rights
 */
export async function checkMultipleContentAccess(contentTypes, userPubkey) {
	// Get all user badges once
	const userBadges = await getUserBadges(userPubkey);

	const accessMap = new Map();

	for (const ct of contentTypes) {
		const canRead = !ct.badges?.read || userBadges.has(ct.badges.read);
		const canWrite = !ct.badges?.write || userBadges.has(ct.badges.write);
		accessMap.set(ct.name, { read: canRead, write: canWrite });
	}

	return accessMap;
}

/**
 * Filter community events to only show legitimate ones (from users with required badges)
 * Uses batch approach for efficiency - fetches badges for all authors at once
 *
 * @param {Object[]} events - Array of Nostr events to filter
 * @param {Object} communityEvent - The kind 10222 community definition event
 * @returns {Promise<Object[]>} Filtered array of legitimate events
 */
export async function filterLegitimateEvents(events, communityEvent) {
	// Lazy import to avoid circular dependency
	const { getKindBadgeRequirements } = await import('$lib/helpers/communityRelays.js');

	if (!events?.length || !communityEvent) return events || [];

	// Get unique authors from events
	const authorPubkeys = [...new Set(events.map((e) => e.pubkey))];

	// Batch fetch badges for all authors
	/** @type {Map<string, Set<string>>} */
	const authorBadges = new Map();

	await Promise.all(
		authorPubkeys.map(async (pubkey) => {
			const badges = await getUserBadges(pubkey);
			authorBadges.set(pubkey, badges);
		})
	);

	// Filter events - only keep those where author has required badge
	return events.filter((event) => {
		const badgeReq = getKindBadgeRequirements(communityEvent, event.kind);

		// No write badge required for this kind → event is legitimate
		if (!badgeReq.writeBadge) return true;

		// Check if author has the required badge
		const userBadges = authorBadges.get(event.pubkey) || new Set();
		return userBadges.has(badgeReq.writeBadge);
	});
}

/**
 * Check if an event author has the required badge for publishing to a community
 * Useful for pre-publish validation
 *
 * @param {Object} communityEvent - The kind 10222 community definition event
 * @param {number} eventKind - The kind of event to publish
 * @param {string} authorPubkey - The author's pubkey
 * @returns {Promise<{allowed: boolean, requiredBadge: string|null}>}
 */
export async function checkCommunityPublishAccess(communityEvent, eventKind, authorPubkey) {
	// Lazy import to avoid circular dependency
	const { getKindBadgeRequirements } = await import('$lib/helpers/communityRelays.js');

	if (!communityEvent || !authorPubkey) {
		return { allowed: false, requiredBadge: null };
	}

	const badgeReq = getKindBadgeRequirements(communityEvent, eventKind);

	if (!badgeReq.writeBadge) {
		return { allowed: true, requiredBadge: null };
	}

	const hasBadge = await userHoldsBadge(badgeReq.writeBadge, authorPubkey);

	return {
		allowed: hasBadge,
		requiredBadge: badgeReq.writeBadge
	};
}
