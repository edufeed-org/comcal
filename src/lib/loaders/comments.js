/**
 * Comment loader for NIP-22 comments
 * Provides a factory for creating timeline loaders specific to event comments
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { getSeenRelays } from 'applesauce-core/helpers';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { timedPool } from '$lib/loaders/base.js';
import { runtimeConfig } from '$lib/stores/config.svelte.js';

/**
 * Factory: Create a comment loader for a specific event
 *
 * This loader fetches all NIP-22 comments (kind 1111) that reference
 * a specific event via the uppercase 'A' tag (root scope).
 *
 * @param {string} eventAddress - The event address in format "kind:pubkey:dtag"
 * @returns {Function} Timeline loader function that returns an Observable
 *
 * @example
 * // Create a loader for an event's comments
 * const commentLoader = createCommentLoader('31923:pubkey123:event-id');
 *
 * // Load comments - each call loads the next page
 * commentLoader().subscribe(comment => {
 *   console.log('Received comment:', comment);
 * });
 *
 * // Load older comments
 * commentLoader().subscribe(comment => {
 *   console.log('Received older comment:', comment);
 * });
 */
export const createCommentLoader = (eventAddress) => {
  if (!eventAddress) {
    throw new Error('Event address is required to create comment loader');
  }

  return createTimelineLoader(
    timedPool,
    runtimeConfig.fallbackRelays || [],
    {
      kinds: [1111], // NIP-22 comments
      '#A': [eventAddress], // Comments for this specific event (root scope)
      limit: 100 // Load 100 comments per page
    },
    { eventStore }
  );
};

/**
 * Create a comment loader for any event type (regular or addressable).
 * Auto-detects the event type and uses the correct filter:
 * - Addressable events (kind 30000-39999): #A filter with address
 * - Regular events: #E filter with event ID
 *
 * Relays are determined from the root event's seen relays (where the event was
 * found on the network) plus fallback relays. This ensures comments are fetched
 * from the same relays as the root event (e.g. communikey relays for forum threads).
 *
 * @param {any} rootEvent - The root event to load comments for
 * @param {string[]} [extraRelays] - Additional relays to query
 * @returns {Function} Timeline loader function that returns an Observable
 */
export const createCommentLoaderForEvent = (rootEvent, extraRelays) => {
  if (!rootEvent) {
    throw new Error('Root event is required to create comment loader');
  }

  const isAddressable = rootEvent.kind >= 30000 && rootEvent.kind < 40000;

  /** @type {import('nostr-tools').Filter} */
  const filter = { kinds: [1111], limit: 100 };

  if (isAddressable) {
    const dTag = rootEvent.tags?.find((/** @type {string[]} */ t) => t[0] === 'd')?.[1] || '';
    filter['#A'] = [`${rootEvent.kind}:${rootEvent.pubkey}:${dTag}`];
  } else {
    filter['#E'] = [rootEvent.id];
  }

  // Use seen relays (where the root event was found) + fallback + any extras
  const seenRelays = getSeenRelays(rootEvent);
  const relays = [
    ...(runtimeConfig.fallbackRelays || []),
    ...(seenRelays ? Array.from(seenRelays) : []),
    ...(extraRelays || [])
  ];
  const uniqueRelays = [...new Set(relays)];

  return createTimelineLoader(timedPool, uniqueRelays, filter, { eventStore });
};
