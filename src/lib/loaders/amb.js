/**
 * AMB resource loading utilities for kind 30142 educational resources.
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { getEducationalRelays } from '$lib/helpers/relay-helper.js';
import { TimelineModel } from 'applesauce-core/models';
import { getTagValue } from 'applesauce-core/helpers';
import { parseAddressPointerFromATag } from '$lib/helpers/nostrUtils.js';
import { SvelteSet } from 'svelte/reactivity';
import { onlyEvents } from 'applesauce-relay/operators';
import { mapEventsToStore } from 'applesauce-core/observable';
import { addressLoader, timedPool } from './base.js';
import { getCuratedAuthors } from '$lib/services/curated-authors-service.svelte.js';
import { communityTargetedPublicationsLoader } from './targeted-publications.js';

/**
 * Get combined relays for AMB resource loading (educational app relays + fallback)
 * Respects gated mode - when active, fallback relays are excluded
 * @returns {string[]} Deduplicated array of relay URLs
 */
function getAMBRelays() {
  return getEducationalRelays();
}

/**
 * Factory: Create a stateful timeline loader for kind 30142 AMB resources with automatic pagination
 * The returned loader function automatically tracks state and fetches the next chronological block on each call
 * @param {number} limit - Maximum number of resources to load per batch
 * @returns {Function} Stateful timeline loader function (call with no args, returns Observable)
 */
export function ambTimelineLoader(limit = 20) {
  /** @type {import('nostr-tools').Filter} */
  const filter = { kinds: [30142] };
  const authors = getCuratedAuthors();
  if (authors) filter.authors = authors;
  return createTimelineLoader(timedPool, getAMBRelays(), filter, { eventStore, limit });
}

/**
 * Hook: Load AMB resources for a specific community
 * Follows the same pattern as loadByCommunity in calendar-event-loader
 *
 * @param {string} communityPubkey - The community's public key
 * @returns {{
 *   subscriptions: Map<string, any>,
 *   cleanup: () => void
 * }}
 */
export function useAMBCommunityLoader(communityPubkey) {
  const subscriptions = new Map();

  if (!communityPubkey) {
    console.warn('📚 AMBLoader: No communityPubkey provided');
    return { subscriptions, cleanup: () => {} };
  }

  console.log('📚 AMBLoader: Starting community loader for', communityPubkey.slice(0, 8));

  // 1. Load direct community resources (kind 30142 with h-tag) from network
  /** @type {any} */
  const directFilter = { kinds: [30142], '#h': [communityPubkey] };
  const curatedAuthorsList = getCuratedAuthors();
  if (curatedAuthorsList) directFilter.authors = curatedAuthorsList;
  const directResourcesLoader = createTimelineLoader(timedPool, getAMBRelays(), directFilter, {
    eventStore,
    limit: 50
  });
  const directResourcesSub = directResourcesLoader().subscribe();
  subscriptions.set('directResources', directResourcesSub);

  // 2. Load targeted publications (kind 30222) referencing AMB resources
  const targetedPubSub = communityTargetedPublicationsLoader(communityPubkey, [
    30142
  ])().subscribe();
  subscriptions.set('targetedPublications', targetedPubSub);

  // 3. Watch targeted publications and load referenced resources on-demand
  const referencedResourcesSub = eventStore
    .model(TimelineModel, {
      kinds: [30222],
      '#p': [communityPubkey],
      '#k': ['30142'],
      limit: 100
    })
    .subscribe((shareEvents) => {
      // Extract unique event IDs and addressable references
      const eventIds = new SvelteSet();
      /** @type {Array<{kind: number, pubkey: string, dTag: string}>} */
      const addressableRefs = [];

      shareEvents.forEach((shareEvent) => {
        const eTag = getTagValue(shareEvent, 'e');
        const aTag = getTagValue(shareEvent, 'a');

        if (eTag) {
          eventIds.add(eTag);
        }
        if (aTag) {
          // Using shared parseAddressPointerFromATag to correctly handle d-tags with colons (like URLs)
          const parsed = parseAddressPointerFromATag(aTag);
          if (parsed) {
            addressableRefs.push({
              kind: parsed.kind,
              pubkey: parsed.pubkey,
              dTag: parsed.identifier // Map identifier -> dTag for consistency with local format
            });
          }
        }
      });

      // Start loader for events by ID - fetch from network
      if (eventIds.size > 0) {
        console.log('📚 AMBLoader: Loading', eventIds.size, 'referenced resources by ID');
        const refByIdSub = pool
          .subscription(getAMBRelays(), { ids: Array.from(eventIds) })
          .pipe(onlyEvents(), mapEventsToStore(eventStore))
          .subscribe();
        subscriptions.set(`refById-${Date.now()}`, refByIdSub);
      }

      // Start loaders for addressable events
      if (addressableRefs.length > 0) {
        console.log(
          '📚 AMBLoader: Loading',
          addressableRefs.length,
          'referenced resources by address'
        );
        addressableRefs.forEach((ref) => {
          addressLoader({
            kind: ref.kind,
            pubkey: ref.pubkey,
            identifier: ref.dTag
          }).subscribe();
        });
      }
    });
  subscriptions.set('referencedResources', referencedResourcesSub);

  // Cleanup function
  function cleanup() {
    console.log('📚 AMBLoader: Cleaning up community loader');
    subscriptions.forEach((sub) => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
    subscriptions.clear();
  }

  return { subscriptions, cleanup };
}
