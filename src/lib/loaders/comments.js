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
