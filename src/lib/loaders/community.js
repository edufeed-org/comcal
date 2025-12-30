/**
 * Community domain loaders for discovering and tracking communities.
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { runtimeConfig } from '$lib/stores/config.svelte.js';

// Communities list loader (kind 10222)
export const communikeyTimelineLoader = createTimelineLoader(
	pool,
	runtimeConfig.calendar.defaultRelays,
	{
		kinds: [10222]
	},
	{ eventStore }
);

// Membership tracking loader factory for community relationships (kind 30382)
// Takes an author pubkey and returns a loader that fetches only that author's relationships
export function createRelationshipLoader(/** @type {string} */ authorPubkey) {
	return createTimelineLoader(
		pool,
		runtimeConfig.calendar.defaultRelays,
		{
			kinds: [30382], // Relationship events
			authors: [authorPubkey], // Filter by specific author
			limit: 100
		},
		{ eventStore }
	);
}

// Community members loader factory - fetches all relationship events for a specific community
// Takes a community pubkey and returns a loader that fetches all users who have relationships with that community
export function createCommunityMembersLoader(/** @type {string} */ communityPubkey) {
	return createTimelineLoader(
		pool,
		runtimeConfig.calendar.defaultRelays,
		{
			kinds: [30382], // Relationship events
			'#d': [communityPubkey] // Filter by community ID
		},
		{ eventStore }
	);
}
