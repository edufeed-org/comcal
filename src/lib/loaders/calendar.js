/**
 * Calendar domain loaders for NIP-52 calendar events.
 * Includes timeline loaders and factory functions for custom filtering.
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { addressLoader } from './base.js';
import { appConfig } from '$lib/config.js';
import { getAddressPointerFromATag } from 'applesauce-core/helpers';

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
// NOTE: This loads ALL calendars without filtering - use userCalendarLoader for user-specific calendars
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
 * Factory: Create a timeline loader for user-specific calendar definitions
 * This loader filters calendars by author at the relay level for efficiency
 * @param {string} userPubkey - The pubkey of the user whose calendars to load
 * @returns {Function} Timeline loader function that returns an Observable
 */
export const userCalendarLoader = (userPubkey) => createTimelineLoader(
	pool,
	appConfig.calendar.defaultRelays,
	{
		kinds: [31924], // Calendar definitions
		authors: [userPubkey], // Filter by user at relay level
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

/**
 * Factory: Create a loader for events referenced by a calendar
 * Uses addressLoader to fetch specific addressable events by their coordinates
 * @param {any} calendar - The raw calendar Event object (kind 31924)
 * @returns {Function} Loader function that returns an Observable
 */
export const calendarEventReferencesLoader = (calendar) => {
	// Parse 'a' tag coordinates into LoadableAddressPointer objects
	// Format: "kind:pubkey:d-tag" -> { kind, pubkey, identifier }
	const pointers = calendar.tags
		.filter((/** @type {any[]} */ tag) => tag[0] === 'a')
		.map((/** @type {any[]} */ tag) => {
			const pointer = getAddressPointerFromATag(tag);
			console.log('📅 calendarEventReferencesLoader: Parsed pointer from a-tag', tag, '->', pointer);
			return pointer;
		});

	console.log('📅 calendarEventReferencesLoader: Found', pointers.length, 'event pointers:', pointers);

	if (pointers.length === 0) {
		console.warn('📅 calendarEventReferencesLoader: No event coordinates found in calendar');
	}

	// Iterate over pointers and call addressLoader for each one
	// addressLoader has built-in batching, so these will be efficiently batched
	return () => from(pointers).pipe(
		mergeMap((/** @type {any} */ pointer) => {
			console.log('📅 Loading event from pointer:', pointer);
			return addressLoader(pointer);
		})
	);
};
