/**
 * Calendar domain loaders for NIP-52 calendar events.
 * Includes timeline loaders and factory functions for custom filtering.
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { from, merge, EMPTY } from 'rxjs';
import { mergeMap, filter, tap } from 'rxjs/operators';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { addressLoader, timedPool } from './base.js';
import { getCalendarRelays, getFallbackRelays } from '$lib/helpers/relay-helper.js';
import { getAppRelaysForCategory } from '$lib/services/app-relay-service.svelte.js';
import { parseAddressPointerFromATag } from '$lib/helpers/nostrUtils.js';
import { isRawEventInDateRange } from '$lib/helpers/calendar.js';

// Global calendar events (kinds 31922, 31923)
// Lazy factory to ensure relays are read from runtime config at call time, not module load time
export const calendarTimelineLoader = () =>
  createTimelineLoader(
    timedPool,
    getCalendarRelays(),
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
  const relaysToUse = customRelays.length > 0 ? customRelays : getCalendarRelays();

  return createTimelineLoader(
    timedPool,
    relaysToUse,
    {
      kinds: [31922, 31923], // NIP-52 calendar events
      limit: 200,
      ...additionalFilters
    },
    { eventStore }
  );
};

/**
 * Create a date-range aware calendar loader that:
 * 1. Queries app relays (calendar-relay) with special date range filter syntax (#start_after, #start_before)
 * 2. Queries fallback relays with standard query + client-side date filtering
 *
 * Both queries run in parallel. The EventStore handles deduplication.
 *
 * @param {number} startTimestamp - Start of date range as Unix timestamp (seconds)
 * @param {number} endTimestamp - End of date range as Unix timestamp (seconds)
 * @param {Object} [options] - Additional options
 * @param {string[]} [options.authors] - Filter by specific authors
 * @param {string[]} [options.customAppRelays] - Override app relays (for testing)
 * @param {string[]} [options.customFallbackRelays] - Override fallback relays (for testing)
 * @returns {Function} Loader function that returns an Observable
 */
export function createDateRangeCalendarLoader(startTimestamp, endTimestamp, options = {}) {
  const { authors, customAppRelays, customFallbackRelays } = options;

  return () => {
    // Get relays - app relays support date range filter, fallback relays don't
    const appRelays = customAppRelays || getAppRelaysForCategory('calendar');
    const fallbackRelays = customFallbackRelays || getFallbackRelays();

    // Build base filter
    /** @type {import('nostr-tools').Filter} */
    const baseFilter = {
      kinds: [31922, 31923]
    };
    if (authors && authors.length > 0) {
      baseFilter.authors = authors;
    }

    // Observable streams to merge
    /** @type {import('rxjs').Observable<import('nostr-tools').NostrEvent>[]} */
    const streams = [];

    // Query 1: App relays with calendar-relay's special date range filter syntax
    // These relays understand #start_after and #start_before as filter parameters
    if (appRelays.length > 0) {
      const appFilter = {
        ...baseFilter,
        '#start_after': [String(startTimestamp)],
        '#start_before': [String(endTimestamp)]
      };

      const appQuery$ = timedPool(appRelays, appFilter).pipe(tap((event) => eventStore.add(event)));
      streams.push(appQuery$);
    }

    // Query 2: Fallback relays with standard query + client-side date filtering
    // These relays don't understand date range filters, so we filter client-side
    if (fallbackRelays.length > 0) {
      const fallbackFilter = {
        ...baseFilter,
        limit: 500 // Reasonable limit for fallback
      };

      const fallbackQuery$ = timedPool(fallbackRelays, fallbackFilter).pipe(
        filter((event) => isRawEventInDateRange(event, startTimestamp, endTimestamp)),
        tap((event) => eventStore.add(event))
      );
      streams.push(fallbackQuery$);
    }

    // Merge all streams - EventStore handles deduplication by event ID
    return streams.length > 0 ? merge(...streams) : EMPTY;
  };
}

// Calendar definition loader for personal calendars (kind 31924)
// NOTE: This loads ALL calendars without filtering - use userCalendarLoader for user-specific calendars
// Lazy factory to ensure relays are read from runtime config at call time, not module load time
export const calendarLoader = () =>
  createTimelineLoader(
    timedPool,
    getCalendarRelays(),
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
export const userCalendarLoader = (userPubkey) =>
  createTimelineLoader(
    timedPool,
    getCalendarRelays(),
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
export const communityCalendarTimelineLoader = (communityPubkey) =>
  createTimelineLoader(
    timedPool,
    getCalendarRelays(),
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
export const targetedPublicationTimelineLoader = (communityPubkey) =>
  createTimelineLoader(
    timedPool,
    getCalendarRelays(),
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
  // Using local parseAddressPointerFromATag to correctly handle d-tags with colons (like URLs)
  const pointers = calendar.tags
    .filter((/** @type {any[]} */ tag) => tag[0] === 'a')
    .map((/** @type {any[]} */ tag) => {
      const pointer = parseAddressPointerFromATag(tag);
      console.log(
        '📅 calendarEventReferencesLoader: Parsed pointer from a-tag',
        tag,
        '->',
        pointer
      );
      return pointer;
    })
    .filter((/** @type {any} */ pointer) => pointer !== null); // Filter out invalid pointers

  console.log(
    '📅 calendarEventReferencesLoader: Found',
    pointers.length,
    'event pointers:',
    pointers
  );

  if (pointers.length === 0) {
    console.warn('📅 calendarEventReferencesLoader: No event coordinates found in calendar');
  }

  // Iterate over pointers and call addressLoader for each one
  // addressLoader has built-in batching, so these will be efficiently batched
  return () =>
    from(pointers).pipe(
      mergeMap((/** @type {any} */ pointer) => {
        console.log('📅 Loading event from pointer:', pointer);
        return addressLoader(pointer);
      })
    );
};
