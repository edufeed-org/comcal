/**
 * Community domain loaders for discovering and tracking communities.
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { appConfig } from '$lib/config.js';

// Communities list loader (kind 10222)
export const communikeyTimelineLoader = createTimelineLoader(
	pool,
	appConfig.calendar.defaultRelays,
	{
		kinds: [10222]
	},
	{ eventStore }
);

// Membership tracking loader for community relationships (kind 30382)
export const relationshipTimelineLoader = createTimelineLoader(
	pool,
	appConfig.calendar.defaultRelays,
	{
		kinds: [30382], // Relationship events
		limit: 100
	},
	{ eventStore }
);
