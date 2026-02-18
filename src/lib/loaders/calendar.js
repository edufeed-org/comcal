/**
 * Calendar domain loaders for NIP-52 calendar events.
 * Includes timeline loaders and factory functions for custom filtering.
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { from, merge, EMPTY } from 'rxjs';
import { mergeMap, filter, tap, switchMap } from 'rxjs/operators';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { addressLoader, timedPool } from './base.js';
import { getCalendarRelays } from '$lib/helpers/relay-helper.js';
import { parseAddressPointerFromATag } from '$lib/helpers/nostrUtils.js';
import {
  isEventStartAfter,
  getEventStartTimestamp,
  getEventEndTimestamp
} from '$lib/helpers/calendar.js';
import { partitionRelaysByNip52Support } from '$lib/services/relay-capabilities.js';

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
 * Create a timeline loader for calendar events with custom relay filtering.
 * Note: Relay resolution is deferred to loader execution time to ensure
 * user override relays (kind 30002) are included even if they load asynchronously.
 * @param {string[]} customRelays - Array of relay URLs to query. If empty, uses default relays.
 * @param {Object} additionalFilters - Additional filter parameters (e.g., authors, limit)
 * @returns {Function} Timeline loader function that returns an Observable
 */
export const createRelayFilteredCalendarLoader = (customRelays = [], additionalFilters = {}) => {
  return () => {
    // Resolve relays at execution time, not creation time
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
    )();
  };
};

/**
 * @typedef {Object} DateRangeFilters
 * @property {number} [startAfter] - Events starting at or after this timestamp
 * @property {number} [startBefore] - Events starting before this timestamp
 * @property {number} [endAfter] - Events ending at or after this timestamp
 * @property {number} [endBefore] - Events ending before this timestamp
 */

/**
 * Create a date-range aware calendar loader with full NIP-52 filter support.
 * Intelligently routes queries based on relay NIP-52 support:
 * - NIP-52 relays: Use #start_after, #start_before, etc. for server-side filtering
 * - Standard relays: Use standard query + client-side date filtering
 *
 * @param {DateRangeFilters} dateRange - Date range filter parameters
 * @param {Object} [options] - Additional options
 * @param {string[]} [options.authors] - Filter by specific authors
 * @returns {Function} Loader function that returns an Observable
 */
export function createDateRangeCalendarLoader(dateRange, options = {}) {
  const { startAfter, startBefore, endAfter, endBefore } = dateRange;
  const { authors } = options;

  return () => {
    const allRelays = getCalendarRelays();

    // Build base filter
    /** @type {any} */
    const baseFilter = {
      kinds: [31922, 31923]
    };
    if (authors && authors.length > 0) {
      baseFilter.authors = authors;
    }

    // Partition relays by actual NIP-52 support, then query appropriately
    return from(partitionRelaysByNip52Support(allRelays)).pipe(
      switchMap(({ nip52Relays, standardRelays }) => {
        /** @type {import('rxjs').Observable<import('nostr-tools').NostrEvent>[]} */
        const streams = [];

        // NIP-52 relays: server-side date filtering via special filter syntax
        if (nip52Relays.length > 0) {
          /** @type {any} */
          const nip52Filter = { ...baseFilter };
          if (startAfter !== undefined) nip52Filter['#start_after'] = [String(startAfter)];
          if (startBefore !== undefined) nip52Filter['#start_before'] = [String(startBefore)];
          if (endAfter !== undefined) nip52Filter['#end_after'] = [String(endAfter)];
          if (endBefore !== undefined) nip52Filter['#end_before'] = [String(endBefore)];

          streams.push(timedPool(nip52Relays, nip52Filter).pipe(tap((e) => eventStore.add(e))));
        }

        // Standard relays: client-side date filtering
        // These relays don't understand NIP-52 date filters, so we over-fetch and filter client-side
        if (standardRelays.length > 0) {
          const standardFilter = {
            ...baseFilter,
            limit: 500 // Over-fetch since we filter client-side
          };

          streams.push(
            timedPool(standardRelays, standardFilter).pipe(
              filter((event) => {
                const eventStart = getEventStartTimestamp(event);
                const eventEnd = getEventEndTimestamp(event) || eventStart;
                if (startAfter !== undefined && eventStart < startAfter) return false;
                if (startBefore !== undefined && eventStart >= startBefore) return false;
                if (endAfter !== undefined && eventEnd < endAfter) return false;
                if (endBefore !== undefined && eventEnd >= endBefore) return false;
                return true;
              }),
              tap((e) => eventStore.add(e))
            )
          );
        }

        // Merge all streams - EventStore handles deduplication by event ID
        return streams.length > 0 ? merge(...streams) : EMPTY;
      })
    );
  };
}

/**
 * Create a paginated calendar loader that loads events by start time.
 * Intelligently routes queries based on relay NIP-52 support:
 * - NIP-52 relays: Use #start_after filter for server-side filtering
 * - Standard relays: Use higher limit + client-side filtering by start tag
 *
 * Uses timedPool wrapper which adds a timeout to pool.request().
 *
 * @param {number} afterStartTimestamp - Load events with start > this timestamp (Unix seconds)
 * @param {Object} [options] - Additional options
 * @param {number} [options.limit=20] - Max events to return per relay type
 * @returns {Function} Loader function that returns an Observable
 */
export function createPaginatedCalendarLoader(afterStartTimestamp, options = {}) {
  const { limit = 20 } = options;

  return () => {
    const allRelays = getCalendarRelays();

    // First partition relays by NIP-52 support, then query
    return from(partitionRelaysByNip52Support(allRelays)).pipe(
      switchMap(({ nip52Relays, standardRelays }) => {
        /** @type {import('rxjs').Observable<import('nostr-tools').NostrEvent>[]} */
        const streams = [];

        // NIP-52 relays: server-side start filtering via #start_after
        if (nip52Relays.length > 0) {
          const nip52Filter = {
            kinds: [31922, 31923],
            '#start_after': [String(afterStartTimestamp)],
            limit
          };
          streams.push(timedPool(nip52Relays, nip52Filter).pipe(tap((e) => eventStore.add(e))));
        }

        // Standard relays: client-side start filtering
        // These relays don't understand #start_after, so we over-fetch and filter client-side
        if (standardRelays.length > 0) {
          const standardFilter = {
            kinds: [31922, 31923],
            limit: limit * 3 // Over-fetch since we filter client-side
          };
          streams.push(
            timedPool(standardRelays, standardFilter).pipe(
              filter((event) => isEventStartAfter(event, afterStartTimestamp)),
              tap((e) => eventStore.add(e))
            )
          );
        }

        return streams.length > 0 ? merge(...streams) : EMPTY;
      })
    );
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
