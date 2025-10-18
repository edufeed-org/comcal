/**
 * Calendar domain loaders for NIP-52 calendar events.
 * Includes timeline loaders and factory functions for custom filtering.
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { appConfig } from '$lib/config.js';

// Global calendar events (kinds 31922, 31923)
export const calendarTimelineLoader = createTimelineLoader(
	pool,
	appConfig.calendar.defaultRelays,
	{
		kinds: [31922, 31923], // NIP-52 calendar events
		limit: 40
	},
	{ eventStore }
);

/**
 * Create a timeline loader for calendar events with custom relay filtering
 * @param {string[]} customRelays - Array of relay URLs to query. If empty, uses default relays.
 * @param {Object} additionalFilters - Additional filter parameters (e.g., authors, limit)
 * @returns {Function} Timeline loader function that returns an Observable
 */
export const createRelayFilteredCalendarLoader = (customRelays = [], additionalFilters = {}) => {
	const relaysToUse = customRelays.length > 0 ? customRelays : appConfig.calendar.defaultRelays;
	
	return createTimelineLoader(
		pool,
		relaysToUse,
		{
			kinds: [31922, 31923], // NIP-52 calendar events
			limit: 200,
			...additionalFilters
		},
		{ eventStore }
	);
};

// Calendar definition loader for personal calendars (kind 31924)
export const calendarLoader = createTimelineLoader(
	pool,
	appConfig.calendar.defaultRelays,
	{
		kinds: [31924], // Calendar definitions
		limit: 100
	},
	{ eventStore }
);

/**
 * Factory: Create a timeline loader for community-specific calendar events
 * @param {string} communityPubkey - The pubkey of the community
 * @returns {Function} Timeline loader function that returns an Observable
 */
export const communityCalendarTimelineLoader = (communityPubkey) => createTimelineLoader(
	pool,
	appConfig.calendar.defaultRelays,
	{
		kinds: [31922, 31923],
		'#h': [communityPubkey], // Community targeting
		limit: 250
	},
	{ eventStore }
);

/**
 * Factory: Create a timeline loader for targeted publication events
 * Targeted publications (kind 30222) are used to publish events to specific communities
 * Now supports both 'a' tag (addressable) and 'e' tag (event ID) references for backward compatibility
 * @param {string} communityPubkey - The pubkey of the community
 * @returns {Function} Timeline loader function that returns an Observable
 */
export const targetedPublicationTimelineLoader = (communityPubkey) => createTimelineLoader(
	pool,
	appConfig.calendar.defaultRelays,
	{
		kinds: [30222], // Targeted Publication Events
		'#p': [communityPubkey], // Community targeting
		'#k': ['31922', '31923'], // Only calendar event kinds
		limit: 100
	},
	{ eventStore }
);
