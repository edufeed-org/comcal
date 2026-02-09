/**
 * App Relay Set Loader - fetches kind 30002 events (NIP-51 relay sets)
 * Following applesauce loader pattern
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { getRelaySetDTag, CATEGORIES } from '$lib/services/app-relay-service.svelte.js';

/**
 * Creates a loader for a user's app-specific relay sets (kind 30002)
 * Loads all app relay categories for the user
 *
 * @param {import('applesauce-relay').RelayPool} pool - Relay pool instance
 * @param {string[]} lookupRelays - Relays to search for relay sets
 * @param {import('applesauce-core').EventStore} eventStore - EventStore instance
 * @param {string} userPubkey - User's public key
 * @returns {Function} Loader factory that returns an Observable
 */
export function createAppRelaySetLoader(pool, lookupRelays, eventStore, userPubkey) {
  // Build d-tags for all app relay categories
  const dTags = Object.keys(CATEGORIES).map((category) => getRelaySetDTag(category));

  return () =>
    createTimelineLoader(
      pool,
      lookupRelays,
      {
        kinds: [30002],
        authors: [userPubkey],
        '#d': dTags
      },
      { eventStore }
    );
}

/**
 * Creates a loader for a single app relay category
 *
 * @param {import('applesauce-relay').RelayPool} pool - Relay pool instance
 * @param {string[]} lookupRelays - Relays to search for relay sets
 * @param {import('applesauce-core').EventStore} eventStore - EventStore instance
 * @param {string} userPubkey - User's public key
 * @param {string} category - Category name ('calendar', 'communikey', 'educational')
 * @returns {Function} Loader factory that returns an Observable
 */
export function createSingleAppRelaySetLoader(
  pool,
  lookupRelays,
  eventStore,
  userPubkey,
  category
) {
  const dTag = getRelaySetDTag(category);

  return () =>
    createTimelineLoader(
      pool,
      lookupRelays,
      {
        kinds: [30002],
        authors: [userPubkey],
        '#d': [dTag]
      },
      { eventStore }
    );
}
