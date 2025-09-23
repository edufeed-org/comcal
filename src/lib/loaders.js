import { createAddressLoader, createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, relays, eventStore } from '$lib/store.svelte';
import { getProfileContent } from 'applesauce-core/helpers';
import { take, map } from 'rxjs';
import { mapEventsToStore } from 'applesauce-core';
import { TimelineModel } from 'applesauce-core/models';

export const addressLoader = createAddressLoader(pool, { eventStore, lookupRelays: relays });
export const communikeyTimelineLoader = createTimelineLoader(
	pool,
	relays,
	{
		kinds: [10222]
	},
	{ eventStore });

// Calendar event loaders following the same pattern
export const calendarTimelineLoader = createTimelineLoader(
	pool,
	relays,
	{
		kinds: [31922, 31923], // NIP-52 calendar events
		limit: 250
	},
	{ eventStore }
);

// Calendar definition loader for personal calendars
export const calendarDefinitionLoader = createTimelineLoader(
	pool,
	relays,
	{
		kinds: [31924], // Calendar definitions
		limit: 100
	},
	{ eventStore }
);

export const communityCalendarTimelineLoader = (communityPubkey) => createTimelineLoader(
	pool,
	relays,
	{
		kinds: [31922, 31923],
		'#h': [communityPubkey], // Community targeting
		limit: 250
	},
	{ eventStore }
);

// Relationship events loader for community membership tracking
export const relationshipTimelineLoader = createTimelineLoader(
	pool,
	relays,
	{
		kinds: [30382], // Relationship events
		limit: 100
	},
	{ eventStore }
);

eventStore.addressableLoader = addressLoader;
eventStore.replaceableLoader = addressLoader;
export const profileLoader = createAddressLoader(pool, {
	eventStore,
	lookupRelays: ['wss://purplepag.es/']
});

export function loadUserProfile(kind, pubkey) {
	return profileLoader({ kind, pubkey, relays }).pipe(
		// Take only the first (most recent) profile
		take(1),
		map((event) => getProfileContent(event))
	);
}

export function kind1Loader(pubkey, limit) {
	return createTimelineLoader(
		pool,
		relays,
		{
			kinds: [1],
			authors: [pubkey],
			limit
		},
		{ eventStore },
	)
}
